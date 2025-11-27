const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [50, 'Name cannot be more than 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        match: [
            /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
            'Please enter a valid email'
        ]
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false // Don't include password in queries by default
    },
    role: {
        type: String,
        enum: ['student', 'professional', 'institution', 'admin'],
        default: 'student'
    },
    avatar: {
        type: String,
        default: function () {
            const avatars = ['👨‍🎓', '👩‍🎓', '👨‍💼', '👩‍💼', '🏛️'];
            return avatars[Math.floor(Math.random() * avatars.length)];
        }
    },
    profile: {
        institution: String,
        city: String,
        skills: [String],
        bio: String,
        socialLinks: {
            linkedin: String,
            github: String,
            twitter: String
        }
    },
    registeredEvents: [{
        event: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Event'
        },
        registeredAt: {
            type: Date,
            default: Date.now
        },
        status: {
            type: String,
            enum: ['registered', 'confirmed', 'attended', 'cancelled'],
            default: 'registered'
        }
    }],
    hostedEvents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event'
    }],
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: String,
    passwordResetToken: String,
    passwordResetExpires: Date,
    lastLogin: Date,
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for better query performance
// Note: email index is automatically created by unique: true
userSchema.index({ role: 1 });
userSchema.index({ 'profile.city': 1 });

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Get public profile
userSchema.methods.getPublicProfile = function () {
    const userObject = this.toObject();
    delete userObject.password;
    delete userObject.emailVerificationToken;
    delete userObject.passwordResetToken;
    delete userObject.passwordResetExpires;
    return userObject;
};

// Check if user is registered for an event
userSchema.methods.isRegisteredForEvent = function (eventId) {
    return this.registeredEvents.some(reg => reg.event.toString() === eventId.toString());
};

module.exports = mongoose.model('User', userSchema);