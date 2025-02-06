import mongoose  from "mongoose";

mongoose.connect('mongodb+srv://agustin:230365@clusteragus.avopn.mongodb.net/ControlSeciones?retryWrites=true&w=majority&appName=ClusterAgus')


.then((db)=> console.log("MongoDB atlas conenected"))
.catch((error)=>console.error(error));

export default mongoose;