const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const router = express.Router();
const Redis = require('redis');

// Redis client setup
const redisClient = Redis.createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - userName
 *         - accountNumber
 *         - emailAddress
 *         - identityNumber
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated MongoDB ID
 *         userName:
 *           type: string
 *           description: User's full name
 *         accountNumber:
 *           type: string
 *           description: Unique account number
 *         emailAddress:
 *           type: string
 *           format: email
 *           description: User's email address
 *         identityNumber:
 *           type: string
 *           description: Unique identity number
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     UsersResponse:
 *       type: object
 *       properties:
 *         users:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/User'
 *         pagination:
 *           type: object
 *           nullable: true
 *           properties:
 *             currentPage:
 *               type: integer
 *               example: 1
 *             totalPages:
 *               type: integer
 *               example: 5
 *             totalItems:
 *               type: integer
 *               example: 50
 *             itemsPerPage:
 *               type: integer
 *               example: 10
 *     Error:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         error:
 *           type: string
 */

// Validation middleware
const validateUser = [
  body('userName').trim().notEmpty().withMessage('Username is required'),
  body('accountNumber').trim().notEmpty().withMessage('Account number is required'),
  body('emailAddress').isEmail().withMessage('Valid email address is required'),
  body('identityNumber').trim().notEmpty().withMessage('Identity number is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

// Validation middleware for optional fields
const validateUserUpdate = [
  body('userName').optional().trim().notEmpty().withMessage('Username cannot be empty if provided'),
  body('accountNumber').optional().trim().notEmpty().withMessage('Account number cannot be empty if provided'),
  body('emailAddress').optional().isEmail().withMessage('Valid email address is required if provided'),
  body('identityNumber').optional().trim().notEmpty().withMessage('Identity number cannot be empty if provided'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get list of users
 *     description: Retrieve a list of users with pagination support and Redis caching
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number (ignored if paginate is 0)
 *         required: false
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page (optional if paginate is 0)
 *         required: false
 *       - in: query
 *         name: paginate
 *         schema:
 *           type: boolean
 *           enum: [0, 1]
 *           default: 1
 *         description: Set to 0 to disable pagination, 1 to enable pagination
 *     responses:
 *       200:
 *         description: List of users with or without pagination info
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UsersResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', async (req, res) => {
  try {
    const paginate = parseInt(req.query.paginate) !== 0;

    if (!paginate) {
      // Check Redis cache for all users
      const cacheKey = `users:list:all`;
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        return res.json(JSON.parse(cachedData));
      }

      // Get all users from database
      const users = await User.find().select('-password').sort({ createdAt: -1 });

      // Cache the result for 5 minutes
      await redisClient.setEx(cacheKey, 300, JSON.stringify({ users }));

      return res.json({ users });
    }

    // Default: Paginated response
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Check Redis cache for paginated users
    const cacheKey = `users:list:${page}:${limit}`;
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    // Get users from database
    const users = await User.find()
      .select('-password')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments();

    const response = {
      users,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    };

    // Cache the result for 5 minutes
    await redisClient.setEx(cacheKey, 300, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userName
 *               - accountNumber
 *               - emailAddress
 *               - identityNumber
 *               - password
 *             properties:
 *               userName:
 *                 type: string
 *               accountNumber:
 *                 type: string
 *               emailAddress:
 *                 type: string
 *                 format: email
 *               identityNumber:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error or user already exists
 *       500:
 *         description: Server error
 */
router.post('/', validateUser, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userName, accountNumber, emailAddress, identityNumber, password } = req.body;
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      userName,
      accountNumber,
      emailAddress,
      identityNumber,
      password: hashedPassword
    });

    await user.save();
    
    // Cache user data in Redis
    const userCache = { ...user.toObject() };
    delete userCache.password;
    await redisClient.set(`user:${accountNumber}`, JSON.stringify(userCache));
    await redisClient.set(`user:identity:${identityNumber}`, JSON.stringify(userCache));

    // Invalidate users list cache
    const cacheKeys = await redisClient.keys('users:list:*');
    if (cacheKeys.length > 0) {
      await redisClient.del(cacheKeys);
    }

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Duplicate entry found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @swagger
 * /users/account/{accountNumber}:
 *   get:
 *     summary: Get user by account number
 *     description: Retrieve a user by their account number with Redis caching
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: accountNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: User's account number
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/account/:accountNumber', async (req, res) => {
  try {
    // Check Redis cache first
    const cachedUser = await redisClient.get(`user:${req.params.accountNumber}`);
    if (cachedUser) {
      return res.json(JSON.parse(cachedUser));
    }

    const user = await User.findOne({ accountNumber: req.params.accountNumber })
      .select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Cache the result
    await redisClient.set(`user:${req.params.accountNumber}`, JSON.stringify(user));
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @swagger
 * /users/identity/{identityNumber}:
 *   get:
 *     summary: Get user by identity number
 *     description: Retrieve a user by their identity number with Redis caching
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: identityNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: User's identity number
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/identity/:identityNumber', async (req, res) => {
  try {
    // Check Redis cache first
    const cachedUser = await redisClient.get(`user:identity:${req.params.identityNumber}`);
    if (cachedUser) {
      return res.json(JSON.parse(cachedUser));
    }

    const user = await User.findOne({ identityNumber: req.params.identityNumber })
      .select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Cache the result
    await redisClient.set(`user:identity:${req.params.identityNumber}`, JSON.stringify(user));
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Update user details
 *     description: Update user information with optional fields. Only provided fields will be updated.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User's MongoDB ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userName:
 *                 type: string
 *               accountNumber:
 *                 type: string
 *               emailAddress:
 *                 type: string
 *                 format: email
 *               identityNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated user details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error or duplicate values
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.put('/:id', validateUserUpdate, async (req, res) => {
  try {
    const userId = req.params.id;
    const updates = req.body;

    // Find current user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check for unique constraints only if the field is being updated
    if (updates.accountNumber || updates.emailAddress || updates.identityNumber) {
      const existingUser = await User.findOne({
        _id: { $ne: userId },
        $or: [
          ...(updates.accountNumber ? [{ accountNumber: updates.accountNumber }] : []),
          ...(updates.emailAddress ? [{ emailAddress: updates.emailAddress }] : []),
          ...(updates.identityNumber ? [{ identityNumber: updates.identityNumber }] : [])
        ]
      });

      if (existingUser) {
        return res.status(400).json({ message: 'Account number, email, or identity number already in use' });
      }
    }

    // Update only provided fields
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    // Clear related cache entries
    await redisClient.del(`user:${updatedUser.accountNumber}`);
    await redisClient.del(`user:${updatedUser.identityNumber}`);

    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete user
 *     description: Delete a user and invalidate related cache
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User's MongoDB ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User deleted successfully
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove from Redis cache
    await redisClient.del(`user:${user.accountNumber}`);
    await redisClient.del(`user:identity:${user.identityNumber}`);

    // Invalidate users list cache
    const cacheKeys = await redisClient.keys('users:list:*');
    if (cacheKeys.length > 0) {
      await redisClient.del(cacheKeys);
    }

    await user.deleteOne();
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;