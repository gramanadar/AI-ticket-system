import { inngest } from "../inngest/client.js";
import Ticket from "../models/ticket.js";

export const createTicket = async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title || !description) {
      return res
        .status(400)
        .json({ message: "Title and description are required" });
    }
    const newTicket = Ticket.create({
      title,
      description,
      createdBy: req.user._id.toString(),
    });

    await inngest.send({
      name: "ticket/created",
      data: {
        ticketId: (await newTicket)._id.toString(),
        title,
        description,
        createdBy: req.user._id.toString(),
      },
    });
    return res.status(201).json({
      message: "Ticket created and processing started",
      ticket: newTicket,
    });
  } catch (error) {
    console.error("Error creating ticket", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getTickets = async (req, res) => {
  try {
    const user = req.user;
    let tickets = [];
    if (user.role !== "user") {
      tickets = await Ticket.find({})
        .populate("assignedTo", ["email", "_id"])
        .sort({ createdAt: -1 })
        .lean();
    } else {
      tickets = await Ticket.find({ createdBy: user._id })
        .select("title description status createdAt")
        .sort({ createdAt: -1 })
        .lean();
    }
    return res.status(200).json({ tickets });
  } catch (error) {
    console.error("Error fetching tickets", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getTicket = async (req, res) => {
  try {
    const user = req.user;
    let ticket;

    if (user.role !== "user") {
      ticket = await Ticket.findById(req.params.id)
        .populate("assignedTo", ["email", "_id"])
        .lean();
    } else {
      ticket = await Ticket.findOne({
        createdBy: user._id,
        _id: req.params.id,
      })
        .select("title description status createdAt")
        .lean();
    }

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }
    return res.status(200).json({ ticket });
  } catch (error) {
    console.error("Error fetching ticket", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, helpfulNotes, assignedTo } = req.body;
    const user = req.user;

    let ticket = await Ticket.findById(id);

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // Only admin or assigned moderator can update status and helpful notes
    if (user.role === "admin" || (ticket.assignedTo && ticket.assignedTo.toString() === user._id.toString())) {
      if (status) ticket.status = status;
      if (helpfulNotes) ticket.helpfulNotes = helpfulNotes;
      if (assignedTo) ticket.assignedTo = assignedTo;
    } else {
      return res.status(403).json({ message: "Forbidden: You do not have permission to update this ticket." });
    }

    await ticket.save();
    return res.status(200).json({ message: "Ticket updated successfully", ticket });
  } catch (error) {
    console.error("Error updating ticket", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
