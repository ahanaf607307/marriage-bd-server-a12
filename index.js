const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000

// middleware
app.use(cors());
app.use(express.json());




// MONGODB STARTS HERE------------------------


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.USER_PASSWROD}@cluser12.xm5ca.mongodb.net/?retryWrites=true&w=majority&appName=Cluser12`;


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
//    mongodb CRUD starts here -----------------
const usersCollection = client.db('marrigeBD').collection('users')

// set Users Data
app.post('/users' , async (req, res) => {
    const user = req.body
    const query = { email: user.email }
    const existingUser = await usersCollection.findOne(query);
    if (existingUser) {
      return res.send({ message: 'user already exists', insertedId: null })
    }
    const result = await usersCollection.insertOne(user)
    res.send(result)
})

// get Users Data 
app.get('/users' , async (req, res) => {
    const user = req.body
    const result = await usersCollection.find(user).toArray()
    res.send(result)
})

// make users Admin api 

app.patch('/users/admin/:id' , async (req, res) => {
    const id = req.params.id
    const filter = {_id : new ObjectId(id)}
    const updatedDoc = {
        $set : {
            role : 'admin'
        }
    }
    const result = await usersCollection.updateOne(filter , updatedDoc)
    res.send(result)
})

// get Admin User Data 
app.get('/users/admin/:email' , async (req, res) => {
    const email = req.params.email
    const query = {email : email}
    const user = await usersCollection.findOne(query)
    let admin = false 
    if(user) {
        admin = user?.role === 'admin'
    }
    res.send({admin})
})


//    mongodb CRUD ends here -----------------
  } finally {
   
  }
}
run().catch(console.dir);


// MONGODB ENDS HERE--------------------------





app.use('/' , (req, res) => {
    res.send('Marriage BD Server is running')
})

app.listen(port , (req,res) => {
    console.log(`Running port is ${port}`)
})