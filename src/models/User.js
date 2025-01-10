const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userName: {
    type: String,
    required: true,
    trim: true
  },
  accountNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  emailAddress: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  identityNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  password: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Create indexes
// userSchema.index({ accountNumber: 1 });
// userSchema.index({ identityNumber: 1 });

module.exports = mongoose.model('User', userSchema);