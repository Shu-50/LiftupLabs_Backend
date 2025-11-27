const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');

// Create transporter
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
};

// Generate verification token
const generateVerificationToken = (userId, email) => {
    return jwt.sign(
        { userId, email },
        process.env.EMAIL_VERIFICATION_SECRET,
        { expiresIn: process.env.VERIFICATION_TOKEN_EXPIRE }
    );
};

// Verify token
const verifyToken = (token) => {
    try {
        return jwt.verify(token, process.env.EMAIL_VERIFICATION_SECRET);
    } catch (error) {
        throw new Error('Invalid or expired verification token');
    }
};

// Send verification email
const sendVerificationEmail = async (email, name, verificationToken) => {
    const transporter = createTransporter();

    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: email,
        subject: 'Verify Your Email - LiftupLabs',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">LiftupLabs</h1>
                </div>
                
                <div style="padding: 30px; background-color: #f9f9f9;">
                    <h2 style="color: #333;">Welcome to LiftupLabs, ${name}!</h2>
                    
                    <p style="color: #666; line-height: 1.6;">
                        Thank you for registering with LiftupLabs. To complete your registration and start exploring events, please verify your email address.
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${verificationUrl}" 
                           style="background: #f97316; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                            Verify Email Address
                        </a>
                    </div>
                    
                    <p style="color: #666; font-size: 14px;">
                        If the button doesn't work, copy and paste this link into your browser:
                        <br>
                        <a href="${verificationUrl}" style="color: #f97316;">${verificationUrl}</a>
                    </p>
                    
                    <p style="color: #666; font-size: 14px;">
                        This verification link will expire in 24 hours.
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                    
                    <p style="color: #999; font-size: 12px; text-align: center;">
                        If you didn't create an account with LiftupLabs, please ignore this email.
                    </p>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Verification email sent successfully to:', email);
        return true;
    } catch (error) {
        console.error('Error sending verification email:', error);
        throw new Error('Failed to send verification email');
    }
};

// Send welcome email after verification
const sendWelcomeEmail = async (email, name) => {
    const transporter = createTransporter();

    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: email,
        subject: 'Welcome to LiftupLabs! 🎉',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">🎉 Welcome to LiftupLabs!</h1>
                </div>
                
                <div style="padding: 30px; background-color: #f9f9f9;">
                    <h2 style="color: #333;">Hi ${name}!</h2>
                    
                    <p style="color: #666; line-height: 1.6;">
                        Your email has been successfully verified! You're now part of the LiftupLabs community.
                    </p>
                    
                    <h3 style="color: #f97316;">What you can do now:</h3>
                    <ul style="color: #666; line-height: 1.8;">
                        <li>🎯 Browse and join exciting events</li>
                        <li>📚 Access educational resources and notes</li>
                        <li>🏢 Explore career opportunities</li>
                        <li>🤝 Connect with the community</li>
                        <li>📝 Host your own events</li>
                    </ul>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.FRONTEND_URL}" 
                           style="background: #f97316; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                            Start Exploring
                        </a>
                    </div>
                    
                    <p style="color: #666; font-size: 14px;">
                        If you have any questions, feel free to reach out to our support team.
                    </p>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Welcome email sent successfully to:', email);
        return true;
    } catch (error) {
        console.error('Error sending welcome email:', error);
        // Don't throw error for welcome email failure
        return false;
    }
};

// Generate password reset token
const generatePasswordResetToken = (userId, email) => {
    return jwt.sign(
        { userId, email, type: 'password-reset' },
        process.env.EMAIL_VERIFICATION_SECRET,
        { expiresIn: '1h' } // Password reset tokens expire in 1 hour
    );
};

// Send password reset email
const sendPasswordResetEmail = async (email, name, resetToken) => {
    const transporter = createTransporter();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: email,
        subject: 'Reset Your Password - LiftupLabs',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">LiftupLabs</h1>
                </div>
                
                <div style="padding: 30px; background-color: #f9f9f9;">
                    <h2 style="color: #333;">Password Reset Request</h2>
                    
                    <p style="color: #666; line-height: 1.6;">
                        Hi ${name},
                    </p>
                    
                    <p style="color: #666; line-height: 1.6;">
                        We received a request to reset your password for your LiftupLabs account. Click the button below to create a new password:
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" 
                           style="background: #f97316; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                            Reset Password
                        </a>
                    </div>
                    
                    <p style="color: #666; font-size: 14px;">
                        If the button doesn't work, copy and paste this link into your browser:
                        <br>
                        <a href="${resetUrl}" style="color: #f97316;">${resetUrl}</a>
                    </p>
                    
                    <p style="color: #666; font-size: 14px;">
                        <strong>This password reset link will expire in 1 hour.</strong>
                    </p>
                    
                    <p style="color: #666; font-size: 14px;">
                        If you didn't request a password reset, please ignore this email or contact support if you have concerns.
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                    
                    <p style="color: #999; font-size: 12px; text-align: center;">
                        For security reasons, this link will expire in 1 hour.
                    </p>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Password reset email sent successfully to:', email);
        return true;
    } catch (error) {
        console.error('Error sending password reset email:', error);
        throw new Error('Failed to send password reset email');
    }
};

// Send password reset confirmation email
const sendPasswordResetConfirmationEmail = async (email, name) => {
    const transporter = createTransporter();

    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: email,
        subject: 'Password Reset Successful - LiftupLabs',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">LiftupLabs</h1>
                </div>
                
                <div style="padding: 30px; background-color: #f9f9f9;">
                    <h2 style="color: #333;">✅ Password Reset Successful</h2>
                    
                    <p style="color: #666; line-height: 1.6;">
                        Hi ${name},
                    </p>
                    
                    <p style="color: #666; line-height: 1.6;">
                        Your password has been successfully reset. You can now log in to your LiftupLabs account with your new password.
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.FRONTEND_URL}/login" 
                           style="background: #f97316; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                            Log In Now
                        </a>
                    </div>
                    
                    <p style="color: #666; font-size: 14px;">
                        If you didn't make this change or believe an unauthorized person has accessed your account, please contact our support team immediately.
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                    
                    <p style="color: #999; font-size: 12px; text-align: center;">
                        This is an automated security notification from LiftupLabs.
                    </p>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Password reset confirmation email sent successfully to:', email);
        return true;
    } catch (error) {
        console.error('Error sending password reset confirmation email:', error);
        // Don't throw error for confirmation email failure
        return false;
    }
};

module.exports = {
    createTransporter,
    generateVerificationToken,
    verifyToken,
    sendVerificationEmail,
    sendWelcomeEmail,
    generatePasswordResetToken,
    sendPasswordResetEmail,
    sendPasswordResetConfirmationEmail
};