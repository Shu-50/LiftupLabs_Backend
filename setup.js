const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');
const Event = require('./models/Event');

// Sample data for development
const sampleUsers = [
    {
        name: 'Admin User',
        email: 'admin@liftuplabs.com',
        password: 'admin123',
        role: 'admin',
        avatar: '👨‍💼',
        profile: {
            institution: 'Liftuplabs',
            city: 'Bangalore',
            bio: 'Platform administrator'
        }
    },
    {
        name: 'John Doe',
        email: 'john@student.com',
        password: 'student123',
        role: 'student',
        avatar: '👨‍🎓',
        profile: {
            institution: 'IIT Delhi',
            city: 'Delhi',
            skills: ['JavaScript', 'React', 'Node.js'],
            bio: 'Computer Science student passionate about web development'
        }
    },
    {
        name: 'Jane Smith',
        email: 'jane@professional.com',
        password: 'professional123',
        role: 'professional',
        avatar: '👩‍💼',
        profile: {
            institution: 'Google',
            city: 'Bangalore',
            skills: ['Python', 'Machine Learning', 'Data Science'],
            bio: 'Senior Software Engineer with 5+ years experience'
        }
    },
    {
        name: 'IIT Bombay',
        email: 'events@iitb.ac.in',
        password: 'institution123',
        role: 'institution',
        avatar: '🏛️',
        profile: {
            institution: 'IIT Bombay',
            city: 'Mumbai',
            bio: 'Premier technical institution in India'
        }
    }
];

const sampleEvents = [
    {
        title: 'National AI Hackathon 2025',
        description: 'Compete to build impactful AI solutions for education and healthcare. Open to all Indian students and professionals. Teams of up to 4 members. This hackathon focuses on creating innovative AI applications that can solve real-world problems in education and healthcare sectors.',
        category: 'hackathon',
        type: 'Hackathon',
        mode: 'Online',
        location: {
            venue: 'Virtual Platform',
            city: 'Online',
            state: 'All India',
            country: 'India'
        },
        dateTime: {
            start: new Date('2025-01-10T09:00:00.000Z'),
            end: new Date('2025-01-12T18:00:00.000Z'),
            timezone: 'Asia/Kolkata'
        },
        registration: {
            deadline: new Date('2025-01-08T23:59:59.000Z'),
            fee: {
                amount: 0,
                currency: 'INR',
                isFree: true
            },
            maxParticipants: 1000,
            currentParticipants: 0,
            requirements: [
                'Indian residents; age 16+',
                'Original submissions only',
                'Team size 1-4; student ID required for student track'
            ],
            teamSize: {
                min: 1,
                max: 4
            }
        },
        prizes: [
            {
                position: 'Winner',
                amount: 100000,
                currency: 'INR',
                description: 'First place winner',
                benefits: ['Cash prize', 'Mentorship', 'Certificate']
            },
            {
                position: 'Runner-up',
                amount: 50000,
                currency: 'INR',
                description: 'Second place winner',
                benefits: ['Cash prize', 'Certificate']
            },
            {
                position: 'Top 10',
                amount: 0,
                currency: 'INR',
                description: 'Top 10 participants',
                benefits: ['Internship interviews', 'Certificate']
            }
        ],
        schedule: [
            {
                day: 'Day 1',
                date: new Date('2025-01-10'),
                events: [
                    { time: '09:00', activity: 'Registration & Welcome', description: 'Check-in and opening ceremony' },
                    { time: '10:00', activity: 'Problem Statement Release', description: 'Hackathon challenges announced' },
                    { time: '11:00', activity: 'Team Formation', description: 'Networking and team building' },
                    { time: '12:00', activity: 'Hacking Begins', description: 'Start working on solutions' }
                ]
            }
        ],
        tags: ['AI/ML', 'Healthcare', 'Education', 'Innovation'],
        skills: ['Python', 'Machine Learning', 'AI', 'Data Science'],
        status: 'published',
        visibility: 'public',
        featured: true,
        faqs: [
            {
                question: 'Is there any fee?',
                answer: 'No, free to participate.'
            },
            {
                question: 'Can professionals join?',
                answer: 'Yes, in open track.'
            },
            {
                question: 'Will certificates be provided?',
                answer: 'Yes, for all participants.'
            }
        ]
    },
    {
        title: 'Web Development Workshop Series',
        description: 'Learn modern web development from scratch. This comprehensive workshop series covers HTML, CSS, JavaScript, React, and Node.js. Perfect for beginners and intermediate developers.',
        category: 'workshop',
        type: 'Workshop',
        mode: 'Hybrid',
        location: {
            venue: 'Tech Hub Bangalore',
            city: 'Bangalore',
            state: 'Karnataka',
            country: 'India'
        },
        dateTime: {
            start: new Date('2024-12-20T10:00:00.000Z'),
            end: new Date('2024-12-22T17:00:00.000Z'),
            timezone: 'Asia/Kolkata'
        },
        registration: {
            deadline: new Date('2024-12-18T23:59:59.000Z'),
            fee: {
                amount: 1500,
                currency: 'INR',
                isFree: false
            },
            maxParticipants: 100,
            currentParticipants: 0,
            requirements: [
                'Basic computer knowledge',
                'Laptop required',
                'No prior coding experience needed'
            ],
            teamSize: {
                min: 1,
                max: 1
            }
        },
        prizes: [
            {
                position: 'All Participants',
                amount: 0,
                currency: 'INR',
                description: 'Certificate of completion',
                benefits: ['Certificate', 'Course materials', 'Project portfolio']
            }
        ],
        tags: ['Web Development', 'JavaScript', 'React', 'Node.js'],
        skills: ['HTML', 'CSS', 'JavaScript', 'React'],
        status: 'published',
        visibility: 'public',
        featured: false,
        faqs: [
            {
                question: 'Do I need prior experience?',
                answer: 'No, this workshop is designed for beginners.'
            },
            {
                question: 'What will I learn?',
                answer: 'Complete web development stack from frontend to backend.'
            }
        ]
    }
];

async function setupDatabase() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/liftuplabs');
        console.log('✅ Connected to MongoDB');

        // Clear existing data
        await User.deleteMany({});
        await Event.deleteMany({});
        console.log('🗑️ Cleared existing data');

        // Create users
        const createdUsers = [];
        for (const userData of sampleUsers) {
            const user = new User(userData);
            await user.save();
            createdUsers.push(user);
            console.log(`👤 Created user: ${user.name} (${user.email})`);
        }

        // Create events with organizers
        for (let i = 0; i < sampleEvents.length; i++) {
            const eventData = sampleEvents[i];
            const organizer = createdUsers[i % createdUsers.length]; // Rotate through users

            eventData.organizer = {
                user: organizer._id,
                name: organizer.name,
                institution: organizer.profile?.institution,
                contact: {
                    email: organizer.email
                }
            };

            const event = new Event(eventData);
            await event.save();

            // Add event to user's hosted events
            organizer.hostedEvents.push(event._id);
            await organizer.save();

            console.log(`🎯 Created event: ${event.title}`);
        }

        console.log('\n🎉 Database setup completed successfully!');
        console.log('\n📋 Sample Login Credentials:');
        console.log('Admin: admin@liftuplabs.com / admin123');
        console.log('Student: john@student.com / student123');
        console.log('Professional: jane@professional.com / professional123');
        console.log('Institution: events@iitb.ac.in / institution123');

    } catch (error) {
        console.error('❌ Setup failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📡 Disconnected from MongoDB');
        process.exit(0);
    }
}

// Run setup
setupDatabase();