const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Event title is required'],
        trim: true,
        maxlength: [100, 'Title cannot be more than 100 characters']
    },
    description: {
        type: String,
        required: [true, 'Event description is required'],
        maxlength: [2000, 'Description cannot be more than 2000 characters']
    },
    organizer: {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        name: {
            type: String,
            required: true
        },
        institution: String,
        contact: {
            email: String,
            phone: String,
            website: String,
            socialMedia: {
                linkedin: String,
                twitter: String,
                instagram: String
            }
        }
    },
    category: {
        type: String,
        required: [true, 'Event category is required'],
        enum: ['hackathon', 'quiz', 'workshop', 'seminar', 'tech-fest', 'competition', 'conference']
    },
    type: {
        type: String,
        required: [true, 'Event type is required'],
        enum: ['Hackathon', 'Quiz', 'Workshop', 'Seminar', 'Tech Fest', 'Competition', 'Conference']
    },
    mode: {
        type: String,
        required: [true, 'Event mode is required'],
        enum: ['Online', 'Offline', 'Hybrid']
    },
    location: {
        venue: String,
        city: String,
        state: String,
        country: {
            type: String,
            default: 'India'
        },
        coordinates: {
            latitude: Number,
            longitude: Number
        }
    },
    dateTime: {
        start: {
            type: Date,
            required: [true, 'Start date is required']
        },
        end: {
            type: Date,
            required: [true, 'End date is required']
        },
        timezone: {
            type: String,
            default: 'Asia/Kolkata'
        }
    },
    registration: {
        deadline: {
            type: Date,
            required: [true, 'Registration deadline is required']
        },
        fee: {
            amount: {
                type: Number,
                default: 0
            },
            currency: {
                type: String,
                default: 'INR'
            },
            isFree: {
                type: Boolean,
                default: true
            }
        },
        maxParticipants: {
            type: Number,
            default: null // No limit by default
        },
        currentParticipants: {
            type: Number,
            default: 0
        },
        requirements: [String],
        teamSize: {
            min: {
                type: Number,
                default: 1
            },
            max: {
                type: Number,
                default: 1
            }
        }
    },
    prizes: [{
        position: {
            type: String,
            required: true
        },
        amount: Number,
        currency: {
            type: String,
            default: 'INR'
        },
        description: String,
        benefits: [String]
    }],
    schedule: [{
        day: String,
        date: Date,
        events: [{
            time: String,
            activity: String,
            description: String
        }]
    }],
    tags: [String],
    skills: [String],
    image: {
        url: String,
        publicId: String
    },
    documents: [{
        name: String,
        url: String,
        type: String
    }],
    participants: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        registeredAt: {
            type: Date,
            default: Date.now
        },
        status: {
            type: String,
            enum: ['registered', 'confirmed', 'attended', 'cancelled'],
            default: 'registered'
        },
        // Contact Information
        phone: {
            type: String,
            required: false // Made optional to handle existing data
        },
        alternateEmail: String,

        // Team Information
        teamName: String,
        teamSize: {
            type: Number,
            default: 1
        },
        teamMembers: [{
            name: {
                type: String,
                required: true
            },
            email: String,
            phone: String,
            role: String,
            institution: String
        }],

        // Additional Information
        institution: String,
        experience: String,
        motivation: String,
        specialRequirements: String,

        // Payment Information (if applicable)
        paymentStatus: {
            type: String,
            enum: ['pending', 'paid', 'failed', 'refunded'],
            default: 'pending'
        },
        paymentId: String,

        // Check-in Information
        checkedIn: {
            type: Boolean,
            default: false
        },
        checkedInAt: Date
    }],
    status: {
        type: String,
        enum: ['draft', 'published', 'ongoing', 'completed', 'cancelled'],
        default: 'draft'
    },
    visibility: {
        type: String,
        enum: ['public', 'private', 'institution-only'],
        default: 'public'
    },
    featured: {
        type: Boolean,
        default: false
    },
    views: {
        type: Number,
        default: 0
    },
    likes: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        likedAt: {
            type: Date,
            default: Date.now
        }
    }],
    faqs: [{
        question: {
            type: String,
            required: true
        },
        answer: {
            type: String,
            required: true
        }
    }],
    socialLinks: {
        website: String,
        discord: String,
        telegram: String,
        whatsapp: String
    },
    sponsors: [{
        name: String,
        logo: String,
        tier: {
            type: String,
            enum: ['title', 'platinum', 'gold', 'silver', 'bronze']
        },
        website: String
    }]
}, {
    timestamps: true
});

// Indexes for better query performance
eventSchema.index({ category: 1 });
eventSchema.index({ type: 1 });
eventSchema.index({ mode: 1 });
eventSchema.index({ 'location.city': 1 });
eventSchema.index({ 'dateTime.start': 1 });
eventSchema.index({ 'registration.deadline': 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ featured: 1 });
eventSchema.index({ tags: 1 });
eventSchema.index({ createdAt: -1 });

// Virtual for formatted date
eventSchema.virtual('formattedDate').get(function () {
    const start = this.dateTime.start;
    const end = this.dateTime.end;

    if (start.toDateString() === end.toDateString()) {
        return start.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    } else {
        return `${start.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short'
        })} - ${end.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        })}`;
    }
});

// Virtual for registration status
eventSchema.virtual('registrationStatus').get(function () {
    const now = new Date();
    if (now > this.registration.deadline) return 'closed';
    // Removed max participants check - events can have unlimited participants
    return 'open';
});

// Method to check if user can register
eventSchema.methods.canUserRegister = function (userId) {
    const now = new Date();

    // Check if registration is still open
    if (now > this.registration.deadline) return { canRegister: false, reason: 'Registration deadline has passed' };

    // Removed max participants check - events can have unlimited participants

    // Check if user is already registered
    const isRegistered = this.participants.some(p => p.user.toString() === userId.toString());
    if (isRegistered) return { canRegister: false, reason: 'Already registered' };

    return { canRegister: true };
};

// Method to register user for event
eventSchema.methods.registerUser = function (userId, registrationData = {}) {
    this.participants.push({
        user: userId,
        phone: registrationData.phone,
        alternateEmail: registrationData.alternateEmail,
        teamName: registrationData.teamName,
        teamSize: registrationData.teamSize || 1,
        teamMembers: registrationData.teamMembers || [],
        institution: registrationData.institution,
        experience: registrationData.experience,
        motivation: registrationData.motivation,
        specialRequirements: registrationData.specialRequirements,
        registeredAt: new Date(),
        status: 'registered'
    });
    this.registration.currentParticipants += 1;
    return this.save();
};

// Method to unregister user from event
eventSchema.methods.unregisterUser = function (userId) {
    this.participants = this.participants.filter(p => p.user.toString() !== userId.toString());
    this.registration.currentParticipants = Math.max(0, this.registration.currentParticipants - 1);
    return this.save();
};

module.exports = mongoose.model('Event', eventSchema);