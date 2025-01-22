const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_KEY);
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// MONGODB STARTS HERE------------------------

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.USER_PASSWROD}@cluser12.xm5ca.mongodb.net/?retryWrites=true&w=majority&appName=Cluser12`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    //    mongodb CRUD starts here -----------------
    const usersCollection = client.db("marrigeBD").collection("users");
    const biodatasCollection = client.db("marrigeBD").collection("biodatas");
    const premiumsCollection = client.db("marrigeBD").collection("premiums");
    const favoritesCollection = client.db("marrigeBD").collection("favorites");
    const contactsCollection = client.db("marrigeBD").collection("contacts");
    const storysCollection = client.db("marrigeBD").collection("storys");

    // Create JWT Token -----------
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_TOKEN, {
        expiresIn: "365d",
      });
      res.send({ token });
    });

    // verify Token ---------
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.JWT_TOKEN, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    //Verify Admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // set Users Data
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // get Users Data
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const query = req.query?.search;
      const searchQuery = {};
      if (query) {
        searchQuery.name = { $regex: query, $options: "i" };
      }
      const result = await usersCollection.find(searchQuery).toArray();
      res.send(result);
    });

    // make users Admin api

    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await usersCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    // get Admin User Data
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    // get User Premium
    app.get("/users/premium/:email",verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });
    // make user premium
    app.patch(
      "/users/premium/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "premium",
          },
        };
        const user = await usersCollection.findOne(filter);
        const filter2 = { email: user.email };
        const updatedDoc2 = {
          $set: {
            bioDataRole: "premium",
          },
        };
        const result = await usersCollection.updateOne(filter, updatedDoc);

        const isUser = await biodatasCollection.updateOne(filter2, updatedDoc2);
        res.send(result);
      }
    );

    // Add Bio Data Post Api
    app.post("/biodatas", verifyToken, async (req, res) => {
      const bioDatas = req.body;
      const lastBiodata = await biodatasCollection
        .find({})
        .sort({ biodataId: -1 })
        .limit(1)
        .toArray();

      const lastId = lastBiodata.length > 0 ? lastBiodata[0].biodataId : 0;
      const newId = lastId + 1;
      bioDatas.biodataId = newId;
      const result = await biodatasCollection.insertOne(bioDatas);
      res.send(result);
    });

    // get All bio Data getApi

    app.get("/biodatas", async (req, res) => {
      const bioDatas = req.body;
      const result = await biodatasCollection.find(bioDatas).toArray();
      res.send(result);
    });
    // get All bio Data getApi for filter for Admin

    app.get("/biodatas/admin", verifyToken, verifyAdmin, async (req, res) => {
      const totalMale = await biodatasCollection.countDocuments({
        genderType: "Male",
      });

      const totalFemale = await biodatasCollection.countDocuments({
        genderType: "Female",
      });
      const totalPremium = await biodatasCollection.countDocuments({
        bioDataRole: "premium",
      });

      const totalRevenue = await contactsCollection
        .aggregate([
          {
            $group: {
              _id: null,
              totalRevenue: {
                $sum: "$price",
              },
            },
          },
        ])
        .toArray();

      const revenue =
        totalRevenue.length > 0 ? totalRevenue[0].totalRevenue : 0;

      const totalBiodata = await biodatasCollection.countDocuments();

      res.send({
        totalMale: totalMale,
        totalFemale: totalFemale,
        totalBiodata: totalBiodata,
        totalPremium : totalPremium,
        revenue: revenue,
      });
    });
    // get All bio Data getApi for filter for User

    app.get("/biodatas/user", async (req, res) => {
      const totalMale = await biodatasCollection.countDocuments({
        genderType: "Male",
      });

      const totalFemale = await biodatasCollection.countDocuments({
        genderType: "Female",
      });

      const totalBiodata = await biodatasCollection.countDocuments();

      res.send({
        totalMale: totalMale,
        totalFemale: totalFemale,
        totalBiodata: totalBiodata,
      });
    });

    // get Male / Female Data for details page ->
    app.post("/biodatas/for-gender",verifyToken, async (req, res) => {
      const { genderType } = req.query;
      let filter = {};
      if (genderType) {
        filter.genderType = genderType;
      }
      const result = await biodatasCollection.find(filter).limit(3).toArray();
      res.send(result);
    });

    // get All Premium bio Data getApi

    app.get("/biodatas/premium", async (req, res) => {
      const result = await biodatasCollection
        .find({ bioDataRole: "premium" })
        .toArray();
      res.send(result);
    });
    // get spacipic bio Data getApi by Id

    app.get("/details/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await biodatasCollection.findOne(filter);
      res.send(result);
    });

    // get One Biodatas route bio data using filter ----------------

    app.get("/biodatas/filter", async (req, res) => {
      const { minAge, maxAge, genderType, permanentDivision } = req.query;
     
      const filter = {};

      if (minAge) {
        filter.age = { ...filter.age, $gte: parseInt(minAge) };
      }
      if (maxAge) {
        filter.age = { ...filter.age, $lte: parseInt(maxAge) };
      }
      if (genderType) {
        filter.genderType = genderType;
      }
      if (permanentDivision) {
        filter.permanentDivision = permanentDivision;
      }
    
      const result = await biodatasCollection.find(filter).toArray();

      res.send(result);
    });

    // get spacipic bio data using email ---

    app.get("/biodatas/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await biodatasCollection.findOne(query);
      res.send(result);
    });

    // update Bio Data using Patch --------
    app.patch("/biodatas-update/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const bodyData = req.body;
      const updatedDoc = {
        $set: {
          name: bodyData.name,
          imageLink: bodyData.imageLink,
          date: bodyData.date,
          genderType: bodyData.genderType,
          height: bodyData.height,
          weight: bodyData.weight,
          age: bodyData.age,
          occupation: bodyData.occupation,
          skinColor: bodyData.skinColor,
          fathersName: bodyData.fathersName,
          partnerAge: bodyData.partnerAge,
          mothersName: bodyData.mothersName,
          partnerHeight: bodyData.partnerHeight,
          partnerWeight: bodyData.partnerWeight,
          permanentDivision: bodyData.permanentDivision,
          presentDivision: bodyData.presentDivision,
          mobileNumber: bodyData.mobileNumber,
          email: bodyData.email,
          userRole: bodyData.userRole,
          bioDataRole: bodyData.bioDataRole,
        },
      };
      const result = await biodatasCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    // get existing bio Data Filterring
    app.get("/biodatas-existing/:email",verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await biodatasCollection.findOne(query);

      let biodata = false;
      if (user) {
        biodata = user?.email === email;
      }

      res.send({ biodata });
    });

    // Favorite Item Post Api --->
    app.post("/favorite", async (req, res) => {
      const favorite = req.body;
      const result = await favoritesCollection.insertOne(favorite);
      res.send(result);
    });

    // get Favorite Item Get api -->
    app.get("/favorite/:favUserEmail", verifyToken, async (req, res) => {
      const email = req.params.favUserEmail;
      const params = { favUserEmail: email };
      const result = await favoritesCollection.find(params).toArray();
      res.send(result);
    });

    // delete Favorite item ---->

    app.delete("/favorite/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await favoritesCollection.deleteOne(query);
      res.send(result);
    });

    // Success Story Post api ------->
    app.post('/successStory' , verifyToken, async(req,res) => {
      const successStory = req.body
      const result = await storysCollection.insertOne(successStory)
      res.send(result)
    })

    // Get Success Story get api data ------->
    app.get('/successStory' , async(req,res) => {
      const successStory = req.body
      const result = await storysCollection.find(successStory).toArray()
      res.send(result)
    })

 
    // Get Limited Success Story get api -->
    app.get('/successStory/home' , async(req,res) => {
      const successStory = req.body
  const result = await storysCollection.find(successStory).limit(4).toArray()
      res.send(result)
    })

      // Get Success Story get api ------->
      app.get('/successStory/:id' , async(req,res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const result = await storysCollection.findOne(filter);
        res.send(result);
      })

    // Admin Part ------------->------------>------

    app.post("/premiums",verifyToken, async (req, res) => {
      const premiumData = req.body;
      const query = { premiumId: premiumData.premiumId };
      const existingPremium = await premiumsCollection.findOne(query);
      if (existingPremium) {
        return res.send({ message: "Item already Added", insertedId: null });
      }
      const result = await premiumsCollection.insertOne(premiumData);
      res.send(result);
    });

    // Get Premium api
    app.get("/premiums", verifyToken, async (req, res) => {
      const premiums = req.body;
      const result = await premiumsCollection.find(premiums).toArray();
      res.send(result);
    });
    // Get Premium card

    app.get("/biodatas-premium", async (req, res) => {
      const query = { bioDataRole: "premium" };
      const result = await biodatasCollection.find(query).limit(6).toArray();
      res.send(result);
    });

    // Get Premium details by id api
    app.get("/premiums/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await premiumsCollection.findOne(filter);
      res.send(result);
    });

    // payment Request Data Post api
    app.post("/contact-request", async (req, res) => {
      const contacts = req.body;
      const result = await contactsCollection.insertOne(contacts);
      res.send(result);
    });

    // Get Contact Api
    app.get("/contact-request", async (req, res) => {
      const contacts = req.body;
      const result = await contactsCollection.find(contacts).toArray();
      res.send(result);
    });

    // Get Contact Reuest api Spacipic user by Email
    app.get(
      "/contact-request/:requesterEmail",
      verifyToken,
      async (req, res) => {
        const email = req.params.requesterEmail;
        const filter = { requesterEmail: email };
        const result = await contactsCollection.find(filter).toArray();
        res.send(result);
      }
    );

    // Update Contact Request Data
    app.patch(
      "/contact-request/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            status: "approved",
          },
        };
        const result = await contactsCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    // Delete Contact Request api using id
    app.delete("/contact-request/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await contactsCollection.deleteOne(query);
      res.send(result);
    });

    // Payment Method --------------->
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    //    mongodb CRUD ends here -----------------
  } finally {
  }
}
run().catch(console.dir);

// MONGODB ENDS HERE--------------------------

app.use("/", (req, res) => {
  res.send("Marriage BD Server is running");
});

app.listen(port, (req, res) => {
  console.log(`Running port is ${port}`);
});
