
const express=require('express')
const { homeInfo, adminHomeInfo } = require("../controllers/Home.controller")
const authMiddleware = require('../middleware/auth.middleware')

const router=express.Router()



router.get('/',authMiddleware,  homeInfo)
router.get('/all',authMiddleware,adminHomeInfo)

module.exports=router