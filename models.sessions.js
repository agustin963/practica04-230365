import { model,Schema } from "mongoose";

const SessionsSchema = new Schema({
   sessionId:{
        unique:true,
        require:true,
        type:String 
    },
    nickname: String,
    email: String,
    macAddress: String,
    ip: String,
    timestamp: { type: Date, default: Date.now }
    
    
},{
    versionKey:false,
    timestamps:true
});

export default model("Session",SessionsSchema);