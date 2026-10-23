const express=require('express')
const { sendNotification, getNotification, getNotificationById, markAllRead, getAllnotification } = require('../controllers/Notification.controller')
const authMiddleware = require('../middleware/auth.middleware')

const routes=express.Router()
routes.use(authMiddleware)
routes.post('/', sendNotification)
routes.post('/markAllRead',markAllRead)
routes.get('/all', getAllnotification)
routes.get('/:id',getNotificationById)
routes.get('/', getNotification)

module.exports=routes