const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    readStatus:{
         type:Boolean,
         default:false
    },
    title: { type: String },
    body: { type: String },
    data: {
        type: Object,
        default: {}
    },

}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
