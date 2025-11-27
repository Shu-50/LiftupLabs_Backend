const express = require('express');
const { body, validationResult } = require('express-validator');
const { createTransporter } = require('../utils/emailService');

const router = express.Router();

// @route   POST /api/contact
// @desc    Submit contact form
// @access  Public
router.post('/', [
    body('fullName')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be between 2 and 100 characters'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please enter a valid email'),
    body('topic')
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage('Topic too long'),
    body('relatedTo')
        .isIn(['General', 'Events', 'Notes', 'Technical', 'Partnership', 'Support', 'Feedback'])
        .withMessage('Invalid category'),
    body('message')
        .trim()
        .isLength({ min: 10, max: 2000 })
        .withMessage('Message must be between 10 and 2000 characters')
], async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { fullName, email, topic, relatedTo, message, sendCopy } = req.body;

        const transporter = createTransporter();

        // Email to admin/support
        const adminMailOptions = {
            from: process.env.EMAIL_FROM,
            to: process.env.CONTACT_EMAIL || process.env.EMAIL_USER,
            replyTo: email,
            subject: `Contact Form: ${relatedTo} - ${topic || 'No Topic'}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 20px; text-align: center;">
                        <h1 style="color: white; margin: 0;">New Contact Form Submission</h1>
                    </div>
                    
                    <div style="padding: 30px; background-color: #f9f9f9;">
                        <h2 style="color: #333; margin-bottom: 20px;">Contact Details</h2>
                        
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold; color: #666;">Name:</td>
                                <td style="padding: 10px; border-bottom: 1px solid #ddd; color: #333;">${fullName}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold; color: #666;">Email:</td>
                                <td style="padding: 10px; border-bottom: 1px solid #ddd; color: #333;">${email}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold; color: #666;">Category:</td>
                                <td style="padding: 10px; border-bottom: 1px solid #ddd; color: #333;">${relatedTo}</td>
                            </tr>
                            ${topic ? `
                            <tr>
                                <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold; color: #666;">Topic:</td>
                                <td style="padding: 10px; border-bottom: 1px solid #ddd; color: #333;">${topic}</td>
                            </tr>
                            ` : ''}
                        </table>
                        
                        <h3 style="color: #333; margin-top: 30px; margin-bottom: 10px;">Message:</h3>
                        <div style="background: white; padding: 20px; border-radius: 5px; border-left: 4px solid #f97316;">
                            <p style="color: #666; line-height: 1.6; margin: 0; white-space: pre-wrap;">${message}</p>
                        </div>
                        
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                        
                        <p style="color: #999; font-size: 12px; text-align: center;">
                            Submitted on ${new Date().toLocaleString('en-IN', {
                dateStyle: 'full',
                timeStyle: 'short',
                timeZone: 'Asia/Kolkata'
            })}
                        </p>
                    </div>
                </div>
            `
        };

        // Send email to admin
        await transporter.sendMail(adminMailOptions);

        // Send copy to user if requested
        if (sendCopy) {
            const userMailOptions = {
                from: process.env.EMAIL_FROM,
                to: email,
                subject: 'Copy of Your Message to LiftupLabs',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 20px; text-align: center;">
                            <h1 style="color: white; margin: 0;">LiftupLabs</h1>
                        </div>
                        
                        <div style="padding: 30px; background-color: #f9f9f9;">
                            <h2 style="color: #333;">Thank you for contacting us!</h2>
                            
                            <p style="color: #666; line-height: 1.6;">
                                Hi ${fullName},
                            </p>
                            
                            <p style="color: #666; line-height: 1.6;">
                                We've received your message and will get back to you within 24-48 hours. Here's a copy of what you sent:
                            </p>
                            
                            <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
                                <p style="color: #666; margin: 5px 0;"><strong>Category:</strong> ${relatedTo}</p>
                                ${topic ? `<p style="color: #666; margin: 5px 0;"><strong>Topic:</strong> ${topic}</p>` : ''}
                                <p style="color: #666; margin: 15px 0 5px 0;"><strong>Message:</strong></p>
                                <p style="color: #666; line-height: 1.6; white-space: pre-wrap;">${message}</p>
                            </div>
                            
                            <p style="color: #666; line-height: 1.6;">
                                If you have any urgent concerns, please don't hesitate to reach out to us directly at 
                                <a href="mailto:support@liftuplabs.in" style="color: #f97316;">support@liftuplabs.in</a>
                            </p>
                            
                            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                            
                            <p style="color: #999; font-size: 12px; text-align: center;">
                                This is an automated message from LiftupLabs.
                            </p>
                        </div>
                    </div>
                `
            };

            try {
                await transporter.sendMail(userMailOptions);
            } catch (error) {
                console.error('Failed to send copy to user:', error);
                // Don't fail the request if user copy fails
            }
        }

        res.json({
            success: true,
            message: 'Thank you for contacting us! We will get back to you soon.'
        });

    } catch (error) {
        console.error('Contact form error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send message. Please try again later.'
        });
    }
});

module.exports = router;
