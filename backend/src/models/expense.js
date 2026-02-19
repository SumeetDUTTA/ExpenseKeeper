import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    catBudget: {
        type: String,
        required: false,
        trim: true,
        default: "Other",
    },
    budgetItemId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
    },
    budgetMonth: {
        type: String,
        required: false,
        match: /^\d{4}-(0[1-9]|1[0-2])$/,
    },
    budgetTimezone: {
        type: String,
        required: false,
        trim: true,
        default: "UTC",
    },
    category: {
        type: String,
        required: true,
        enum: [
            // Categories matching the ML training data exactly
            'Food & Drink',      // was 'Food'
            'Travel',            // was 'Transport' 
            'Utilities',
            'Entertainment',
            'Health & Fitness',  // was 'Healthcare'
            'Shopping',          // was missing
            'Rent',              // was 'Housing'
            'Other',
            // Additional categories for comprehensive expense tracking
            'Salary',            // Income/expense category from training data
            'Investment',        // Income/expense category from training data
            'Clothing',          // Keep for user convenience
            'Education',         // Keep for user convenience
            'Personal Care',     // Keep for user convenience
        ],
        default: 'Other',
        trim: true,
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    note: {
        type: String,
        required: false,
        trim: true,
        default: ""
    }
}, {timestamps: true});

const Expense = mongoose.model('Expense', expenseSchema.index({ user: 1, date: 1 }));

export default Expense;