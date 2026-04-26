const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { sendRegistrationEmail } = require('../utils/emailService');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ─── REGISTER ───────────────────────────────────────────
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // 1. Check all fields are provided
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // 2. Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // 3. Validate role
    const allowedRoles = ['patient', 'doctor', 'staff'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // 4. Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 5. Save user to DB
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      authProvider: 'local'
    });

    // 6. Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // 7. Send welcome email (non-blocking)
    sendRegistrationEmail(user.name, user.email, user.role);

    // 8. Send response
    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      redirect: getDashboardByRole(user.role)
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─── LOGIN ──────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Check fields
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // 2. Find user in DB
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // 3. If user signed up with Google, tell them to use Google login
    if (user.authProvider === 'google') {
      return res.status(400).json({ message: 'This account uses Google Sign-In. Please use the "Sign in with Google" button.' });
    }

    // 4. Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // 5. Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // 6. Send response with redirect path
    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      redirect: getDashboardByRole(user.role)
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─── GOOGLE LOGIN ───────────────────────────────────────
const googleLogin = async (req, res) => {
  try {
    const { credential, role } = req.body;

    if (!credential) {
      return res.status(400).json({ message: 'Google credential is required' });
    }

    // 1. Verify Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // 2. Check if user already exists
    let user = await User.findOne({ email });

    if (user) {
      // User exists — update googleId if not set
      if (!user.googleId) {
        user.googleId = googleId;
        user.authProvider = 'google';
        await user.save();
      }
    } else {
      // 3. New user — create account
      const userRole = role || 'patient'; // default to patient
      const allowedRoles = ['patient', 'doctor', 'staff'];
      
      user = await User.create({
        name,
        email,
        googleId,
        authProvider: 'google',
        role: allowedRoles.includes(userRole) ? userRole : 'patient'
      });

      // Send welcome email (non-blocking)
      sendRegistrationEmail(user.name, user.email, user.role);
    }

    // 4. Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // 5. Send response
    res.status(200).json({
      message: 'Google login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      redirect: getDashboardByRole(user.role)
    });

  } catch (error) {
    console.error('Google login error:', error.message);
    res.status(500).json({ message: 'Google authentication failed', error: error.message });
  }
};

// ─── HELPER — Role to Dashboard Path ────────────────────
const getDashboardByRole = (role) => {
  switch (role) {
    case 'patient': return '../dashboards/patient.html';
    case 'doctor':  return '../dashboards/doctor.html';
    case 'staff':   return '../dashboards/staff.html';
    default:        return '../index.html';
  }
};

module.exports = { register, login, googleLogin };