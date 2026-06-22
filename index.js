const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGO_DB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

client
  .connect()
  .then(() => console.log("Successfully connected to MongoDB Cluster"))
  .catch((err) => console.error("Database connection error:", err));

const database = client.db(process.env.AUTH_DB_NAME || "b_13_assignment_10");
const ebooksCollection = database.collection("ebooks");
const usersCollection = database.collection("user");
const sessionCollection = database.collection("session");
const transactionsCollection = database.collection("transactions");
const bookmarksCollection = database.collection("bookmarks");

// MIDDLEWARES

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers?.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  const session = await sessionCollection.findOne({ token: token });
  if (!session) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  // BetterAuth stores session user IDs as strings. We support both string & ObjectId lookups.
  const user =
    (await usersCollection.findOne({ _id: session.userId })) ||
    (await usersCollection.findOne({ id: session.userId }));

  if (!user) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  req.user = user;
  next();
};

const verifyWriter = async (req, res, next) => {
  if (req.user?.role !== "writer" && req.user?.role !== "admin") {
    return res
      .status(403)
      .send({ message: "Forbidden access. Writer privileges required." });
  }
  next();
};

const verifyAdmin = async (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res
      .status(403)
      .send({
        message: "Forbidden access. Administrator privileges required.",
      });
  }
  next();
};

// ENDPOINTS

app.get("/", (req, res) => {
  res.send("Fable Platform Express Server Online");
});

// 1. Ebooks - Public Browse Catalog
app.get("/api/ebooks", async (req, res) => {
  const query = {};

  if (req.query.search) {
    query.$or = [
      { title: { $regex: req.query.search, $options: "i" } },
      { writerName: { $regex: req.query.search, $options: "i" } },
    ];
  }

  if (req.query.genre && req.query.genre !== "All") {
    query.genre = req.query.genre;
  }

  if (req.query.status) {
    query.status = req.query.status;
  }

  if (req.query.minPrice || req.query.maxPrice) {
    query.price = {};
    if (req.query.minPrice) query.price.$gte = parseFloat(req.query.minPrice);
    if (req.query.maxPrice) query.price.$lte = parseFloat(req.query.maxPrice);
  }

  // Sorting
  let sortOption = { createdAt: -1 };
  if (req.query.sort) {
    if (req.query.sort === "Price: Low to High") {
      sortOption = { price: 1 };
    } else if (req.query.sort === "Price: High to Low") {
      sortOption = { price: -1 };
    }
  }

  // Pagination parameters
  const page = parseInt(req.query.page) || 1;
  const perPage = parseInt(req.query.perPage) || 8;
  const skipItems = (page - 1) * perPage;

  try {
    const total = await ebooksCollection.countDocuments(query);
    const ebooks = await ebooksCollection
      .find(query)
      .sort(sortOption)
      .skip(skipItems)
      .limit(perPage)
      .toArray();

    res.send({ total, ebooks });
  } catch (err) {
    res
      .status(500)
      .send({ message: "Error fetching ebooks", error: err.message });
  }
});

// Single Ebook Details Page
app.get("/api/ebooks/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const ebook = await ebooksCollection.findOne(query);
    if (!ebook) {
      return res.status(404).send({ message: "Ebook not found" });
    }
    res.send(ebook);
  } catch (err) {
    res.status(500).send({ message: "Invalid ID parameters" });
  }
});

// 2. Writer Ebook Upload (Requires verifiedWriter status check)
app.post("/api/ebooks", verifyToken, verifyWriter, async (req, res) => {
  const user = req.user;

  // Enforce one-time payment verification before allowing publishing uploads
  if (!user.verifiedWriter && user.role !== "admin") {
    return res.status(403).send({
      message:
        "Access Restricted. Complete your one-time verification fee to unlock publishing capabilities.",
    });
  }

  const ebookData = req.body;
  const newEbook = {
    ...ebookData,
    price: parseFloat(ebookData.price),
    writerId: user._id.toString(),
    writerName: user.name,
    status: "Available",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    const result = await ebooksCollection.insertOne(newEbook);
    res.status(201).send(result);
  } catch (err) {
    res.status(500).send({ message: "Could not create ebook entry" });
  }
});

// Edit Ebook (Writers only for their own ebooks, or Admin)
app.patch("/api/ebooks/:id", verifyToken, verifyWriter, async (req, res) => {
  try {
    const id = req.params.id;
    const updateData = req.body;
    const query = { _id: new ObjectId(id) };

    const ebook = await ebooksCollection.findOne(query);
    if (!ebook) {
      return res.status(404).send({ message: "Ebook not found" });
    }

    if (
      ebook.writerId !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).send({ message: "Unauthorized modification" });
    }

    const updatedDoc = {
      $set: {
        title: updateData.title || ebook.title,
        description: updateData.description || ebook.description,
        price: updateData.price ? parseFloat(updateData.price) : ebook.price,
        genre: updateData.genre || ebook.genre,
        status: updateData.status || ebook.status,
        coverImage: updateData.coverImage || ebook.coverImage,
        updatedAt: new Date(),
      },
    };

    const result = await ebooksCollection.updateOne(query, updatedDoc);
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: "Modification error" });
  }
});

// Delete Ebook
app.delete("/api/ebooks/:id", verifyToken, verifyWriter, async (req, res) => {
  try {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };

    const ebook = await ebooksCollection.findOne(query);
    if (!ebook) {
      return res.status(404).send({ message: "Ebook not found" });
    }

    if (
      ebook.writerId !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).send({ message: "Unauthorized modification" });
    }

    const result = await ebooksCollection.deleteOne(query);
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: "Deletion error" });
  }
});

// Get Ebooks Uploaded By Logged-In Writer
app.get(
  "/api/writer/my-ebooks",
  verifyToken,
  verifyWriter,
  async (req, res) => {
    try {
      const query = { writerId: req.user._id.toString() };
      const myEbooks = await ebooksCollection.find(query).toArray();
      res.send(myEbooks);
    } catch (err) {
      res.status(500).send({ message: "Error loading writer catalog" });
    }
  },
);

// 3. Transactions Endpoint (Stripe Success Interlock)
app.post("/api/transactions", verifyToken, async (req, res) => {
  const { transactionId, type, ebookId, buyerEmail, writerEmail, amount } =
    req.body;

  const txRecord = {
    transactionId,
    type, // "publishing fee" or "purchase"
    ebookId: ebookId || null,
    buyerEmail,
    writerEmail: writerEmail || null,
    amount: parseFloat(amount),
    createdAt: new Date(),
  };

  try {
    const result = await transactionsCollection.insertOne(txRecord);

    if (type === "publishing fee") {
      // Upgrade the writer verification state
      await usersCollection.updateOne(
        { email: buyerEmail },
        { $set: { verifiedWriter: true } },
      );
    } else if (type === "purchase" && ebookId) {
      // Mark target ebook as Sold
      await ebooksCollection.updateOne(
        { _id: new ObjectId(ebookId) },
        { $set: { status: "Sold" } },
      );
    }

    res.status(201).send(result);
  } catch (err) {
    res
      .status(500)
      .send({ message: "Transaction booking failure", error: err.message });
  }
});

// Writer Sales History
app.get("/api/writer/sales", verifyToken, verifyWriter, async (req, res) => {
  try {
    const query = {
      type: "purchase",
      writerEmail: req.user.email,
    };
    const sales = await transactionsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
    res.send(sales);
  } catch (err) {
    res.status(500).send({ message: "Error loading sales history" });
  }
});

// 4. Admin - Manage Users List
app.get("/api/admin/users", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const users = await usersCollection.find().toArray();
    res.send(users);
  } catch (err) {
    res.status(500).send({ message: "Error loading system users list" });
  }
});

// Admin - Change User Role
app.patch(
  "/api/admin/users/:id/role",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const id = req.params.id;
      const { role } = req.body;

      const query = { _id: id }; // BetterAuth user IDs are standard strings
      const updatedDoc = {
        $set: { role: role },
      };

      const result = await usersCollection.updateOne(query, updatedDoc);
      res.send(result);
    } catch (err) {
      res.status(500).send({ message: "Error updating user role" });
    }
  },
);

// Admin - Delete User
app.delete(
  "/api/admin/users/:id",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const id = req.params.id;
      const query = { _id: id };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    } catch (err) {
      res.status(500).send({ message: "Error removing user" });
    }
  },
);

// Admin - All Transactions
app.get(
  "/api/admin/transactions",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const transactions = await transactionsCollection
        .find()
        .sort({ createdAt: -1 })
        .toArray();
      res.send(transactions);
    } catch (err) {
      res.status(500).send({ message: "Error loading transactions" });
    }
  },
);

// Admin - Analytics Aggregator
app.get("/api/admin/analytics", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const totalUsers = await usersCollection.countDocuments();
    const totalWriters = await usersCollection.countDocuments({
      role: "writer",
    });
    const totalEbooks = await ebooksCollection.countDocuments();

    // Aggregating revenue
    const revenueAggr = await transactionsCollection
      .aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }])
      .toArray();
    const totalRevenue = revenueAggr[0]?.total || 0;

    res.send({
      totalUsers,
      totalWriters,
      totalEbooks,
      totalRevenue,
    });
  } catch (err) {
    res.status(500).send({ message: "Error parsing ecosystem analytics" });
  }
});

app.listen(port, () => {
  console.log(`Fable Server listening on port ${port}`);
});

module.exports = app;
