const mongoose =require('mongoose')


const businessSchema=new mongoose.Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    },
    name:{
        type:String,
        trim:true
    },
    email:{
        type:String,
        trim:true
    },
    phone:{
        type:String,
        trim:true
    },
    profileUrl:{
        type:String,
        trim:true
    }

})
const Business=mongoose.model('BusinessProfile',businessSchema)
module.exports= Business