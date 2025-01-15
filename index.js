const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000

// middleware
app.use(cors());
app.use(express.json());

app.use('/' , (req, res) => {
    res.send('Marriage BD Server is running')
})

app.listen(port , (req,res) => {
    console.log(`Running port is ${port}`)
})