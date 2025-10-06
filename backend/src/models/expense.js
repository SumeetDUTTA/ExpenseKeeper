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
    category: {
        type: String,
        required: true,
        enum: [
            'Food', 'Transport', 'Utilities',
            'Entertainment', 'Healthcare', "Clothing",
            'Education', 'Pets', 'Personal Care',
            'Gifts & Donations', 'Housing', 'Other'
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