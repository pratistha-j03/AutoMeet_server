import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js'; 

const router = express.Router();

// POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({
      name,
      email,
      password: hashedPassword,
      calendar_provider: 'google'
    });

    await user.save();

    const payload = { user: { id: user._id } };
    const secret = process.env.JWT_SECRET;
    
    const token = jwt.sign(payload, secret, { expiresIn: '5d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    const payload = { user: { id: user._id } };
    const secret = process.env.JWT_SECRET;

    const token = jwt.sign(payload, secret, { expiresIn: '5d' });
    res.json({ token });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

export default router;