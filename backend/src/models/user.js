import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, select: false, minlength: 6 },
    authProvider: {
        type: String,
        enum: ['local', 'google', 'discord'],
        default: 'local',
        required: true
    },
    googleId: { type: String, unique: true, sparse: true },
    discordId: { type: String, unique: true, sparse: true },
    monthlyBudget: { type: Number, default: 0 },
    userType: {
        type: String, enum: [
            'college_student',
            'young_professional',
            'family_moderate',
            'family_high',
            'luxury_lifestyle',
            'senior_retired'
        ], default: 'college_student'
    },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;
