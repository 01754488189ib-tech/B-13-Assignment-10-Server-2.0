const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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
  .then(() => {
    console.log("Successfully connected to MongoDB Cluster");
    const usersColl = client
      .db(process.env.AUTH_DB_NAME || "b_13_assignment_10")
      .collection("user");
    usersColl
      .updateMany(
        { email: { $in: ["01754488189ib@gmail.com", "admin@fable.com"] } },
        { $set: { role: "admin" } },
      )
      .then(() => console.log("Admin account checks completed"))
      .catch((err) => console.error("Admin check failed", err));
  })
  .catch((err) => console.error("Database connection error:", err));

const database = client.db(process.env.AUTH_DB_NAME || "b_13_assignment_10");
const ebooksCollection = database.collection("ebooks");
const usersCollection = database.collection("user");
const sessionCollection = database.collection("session");
const transactionsCollection = database.collection("transactions");
const bookmarksCollection = database.collection("bookmarks");

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
    return res.status(403).send({
      message: "Forbidden access. Administrator privileges required.",
    });
  }
  next();
};

app.get("/", (req, res) => {
  res.send("Fable Platform Express Server Online");
});

app.get("/api/seed-database", async (req, res) => {
  try {
    await ebooksCollection.deleteMany({});
    await transactionsCollection.deleteMany({});
    await bookmarksCollection.deleteMany({});

    const seedEbooks = [
      {
        title: "Nebula Odyssey",
        description:
          "An epic journey through uncharted space sectors, exploring ancient alien technology and stellar anomalies.",
        price: 14.99,
        genre: "Sci-Fi",
        writerId: "writer_1",
        writerName: "Alina Vance",
        writerEmail: "alina@fable.com",
        status: "Available",
        coverGradient: "from-blue-600 via-indigo-700 to-purple-800",
        createdAt: new Date("2026-02-15T08:00:00Z"),
        updatedAt: new Date("2026-02-15T08:00:00Z"),
      },
      {
        title: "The Lost Realm",
        description:
          "A young cartographer discovers a hidden kingdom buried beneath the shifting sands of the deep desert.",
        price: 9.99,
        genre: "Fantasy",
        writerId: "writer_2",
        writerName: "Evelyn Thorne",
        writerEmail: "evelyn@fable.com",
        status: "Available",
        coverGradient: "from-amber-600 via-orange-700 to-red-800",
        createdAt: new Date("2026-03-10T10:30:00Z"),
        updatedAt: new Date("2026-03-10T10:30:00Z"),
      },
      {
        title: "Midnight Mystery",
        description:
          "A retired detective is drawn back into the shadows after receiving a series of cryptic, unsigned letters.",
        price: 11.5,
        genre: "Mystery",
        writerId: "writer_3",
        writerName: "Jasper Finch",
        writerEmail: "jasper@fable.com",
        status: "Available",
        coverGradient: "from-zinc-800 to-zinc-950",
        createdAt: new Date("2026-04-05T14:20:00Z"),
        updatedAt: new Date("2026-04-05T14:20:00Z"),
      },
      {
        title: "Rhythms of Love",
        description:
          "Two musicians from completely different worlds find harmony in their shared devotion to jazz and melody.",
        price: 8.99,
        genre: "Romance",
        writerId: "writer_2",
        writerName: "Evelyn Thorne",
        writerEmail: "evelyn@fable.com",
        status: "Available",
        coverGradient: "from-rose-500 via-pink-600 to-red-700",
        createdAt: new Date("2026-04-20T11:15:00Z"),
        updatedAt: new Date("2026-04-20T11:15:00Z"),
      },
      {
        title: "The Creeping Shadow",
        description:
          "Unexplained occurrences in a remote village lead to the uncovering of an ancient, sleeping presence.",
        price: 12.0,
        genre: "Horror",
        writerId: "writer_3",
        writerName: "Jasper Finch",
        writerEmail: "jasper@fable.com",
        status: "Sold",
        coverGradient: "from-emerald-900 to-black",
        createdAt: new Date("2026-05-12T09:00:00Z"),
        updatedAt: new Date("2026-05-12T09:00:00Z"),
      },
      {
        title: "Echoes of Eternity",
        description:
          "A collection of contemporary short stories discussing identity, loss, and our timeless search for meaning.",
        price: 7.5,
        genre: "Fiction",
        writerId: "writer_1",
        writerName: "Alina Vance",
        writerEmail: "alina@fable.com",
        status: "Available",
        coverGradient: "from-teal-600 to-blue-800",
        createdAt: new Date("2026-06-01T16:45:00Z"),
        updatedAt: new Date("2026-06-01T16:45:00Z"),
      },
    ];

    const booksInsert = await ebooksCollection.insertMany(seedEbooks);
    const insertedIds = Object.values(booksInsert.insertedIds);

    const seedTransactions = [
      {
        transactionId: "TX_SEED_1001",
        type: "publishing fee",
        ebookId: null,
        buyerEmail: "writer_1@fable.com",
        amount: 20.0,
        createdAt: new Date("2026-02-14T12:00:00Z"),
      },
      {
        transactionId: "TX_SEED_1002",
        type: "publishing fee",
        ebookId: null,
        buyerEmail: "writer_2@fable.com",
        amount: 20.0,
        createdAt: new Date("2026-03-09T12:00:00Z"),
      },
      {
        transactionId: "TX_SEED_1003",
        type: "purchase",
        ebookId: insertedIds[0],
        ebookTitle: "Nebula Odyssey",
        buyerEmail: "reader_test@fable.com",
        writerEmail: "alina@fable.com",
        amount: 14.99,
        createdAt: new Date("2026-02-20T15:30:00Z"),
      },
      {
        transactionId: "TX_SEED_1004",
        type: "purchase",
        ebookId: insertedIds[1],
        ebookTitle: "The Lost Realm",
        buyerEmail: "reader_test@fable.com",
        writerEmail: "evelyn@fable.com",
        amount: 9.99,
        createdAt: new Date("2026-03-15T10:00:00Z"),
      },
      {
        transactionId: "TX_SEED_1005",
        type: "purchase",
        ebookId: insertedIds[2],
        ebookTitle: "Midnight Mystery",
        buyerEmail: "reader_test@fable.com",
        writerEmail: "jasper@fable.com",
        amount: 11.5,
        createdAt: new Date("2026-04-10T14:00:00Z"),
      },
      {
        transactionId: "TX_SEED_1006",
        type: "purchase",
        ebookId: insertedIds[3],
        ebookTitle: "Rhythms of Love",
        buyerEmail: "reader_test2@fable.com",
        writerEmail: "evelyn@fable.com",
        amount: 8.99,
        createdAt: new Date("2026-05-05T11:00:00Z"),
      },
      {
        transactionId: "TX_SEED_1007",
        type: "purchase",
        ebookId: insertedIds[4],
        ebookTitle: "The Creeping Shadow",
        buyerEmail: "reader_test2@fable.com",
        writerEmail: "jasper@fable.com",
        amount: 12.0,
        createdAt: new Date("2026-05-25T16:00:00Z"),
      },
      {
        transactionId: "TX_SEED_1008",
        type: "purchase",
        ebookId: insertedIds[5],
        ebookTitle: "Echoes of Eternity",
        buyerEmail: "reader_test@fable.com",
        writerEmail: "alina@fable.com",
        amount: 7.5,
        createdAt: new Date("2026-06-12T09:30:00Z"),
      },
    ];

    await transactionsCollection.insertMany(seedTransactions);

    await usersCollection.updateMany(
      { email: { $in: ["01754488189ib@gmail.com", "admin@fable.com"] } },
      { $set: { role: "admin" } },
    );

    res.send({
      success: true,
      message:
        "Database successfully seeded with ebooks and transactions. Verified admins upgraded.",
      insertedEbooksCount: seedEbooks.length,
      insertedTransactionsCount: seedTransactions.length,
    });
  } catch (err) {
    res.status(500).send({ message: "Seeding failed", error: err.message });
  }
});

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

  let sortOption = { createdAt: -1 };
  if (req.query.sort) {
    if (req.query.sort === "Price: Low to High") {
      sortOption = { price: 1 };
    } else if (req.query.sort === "Price: High to Low") {
      sortOption = { price: -1 };
    }
  }

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

app.post("/api/ebooks", verifyToken, verifyWriter, async (req, res) => {
  const user = req.user;

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

app.post("/api/create-checkout-session", verifyToken, async (req, res) => {
  const { type, ebookId, price } = req.body;
  const user = req.user;

  try {
    let line_items = [];
    let metadata = {
      type,
      userEmail: user.email,
    };

    if (type === "publishing fee") {
      line_items = [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Writer Verification Fee",
              description: "One-time payment to publish ebooks on Fable",
            },
            unit_amount: Math.round(parseFloat(price) * 100),
          },
          quantity: 1,
        },
      ];
    } else if (type === "purchase") {
      const ebook = await ebooksCollection.findOne({
        _id: new ObjectId(ebookId),
      });
      if (!ebook) {
        return res.status(404).send({ message: "Ebook not found" });
      }
      if (ebook.status === "Sold") {
        return res.status(400).send({ message: "Ebook already sold" });
      }

      metadata.ebookId = ebookId;
      metadata.writerEmail = ebook.writerEmail || ebook.writerId;
      metadata.ebookTitle = ebook.title;

      line_items = [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: ebook.title,
              description: `Ebook by ${ebook.writerName}`,
              images: ebook.coverImage ? [ebook.coverImage] : [],
            },
            unit_amount: Math.round(parseFloat(ebook.price) * 100),
          },
          quantity: 1,
        },
      ];
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items,
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/payment/cancel`,
      metadata,
    });

    res.send({ id: session.id, url: session.url });
  } catch (err) {
    res
      .status(500)
      .send({ message: "Error creating payment session", error: err.message });
  }
});

app.get("/api/verify-payment", verifyToken, async (req, res) => {
  const { session_id } = req.query;
  if (!session_id) {
    return res.status(400).send({ message: "Session ID required" });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== "paid") {
      return res.status(400).send({ message: "Payment not completed" });
    }

    const existingTx = await transactionsCollection.findOne({
      transactionId: session_id,
    });
    if (existingTx) {
      return res.send({
        success: true,
        alreadyProcessed: true,
        transaction: existingTx,
      });
    }

    const { type, userEmail, ebookId, writerEmail, ebookTitle } =
      session.metadata;
    const amount = session.amount_total / 100;

    const txRecord = {
      transactionId: session_id,
      type,
      ebookId: ebookId ? new ObjectId(ebookId) : null,
      ebookTitle: ebookTitle || null,
      buyerEmail: userEmail,
      writerEmail: writerEmail || null,
      amount,
      createdAt: new Date(),
    };

    const result = await transactionsCollection.insertOne(txRecord);

    if (type === "publishing fee") {
      await usersCollection.updateOne(
        { email: userEmail },
        { $set: { verifiedWriter: true } },
      );
    } else if (type === "purchase" && ebookId) {
      await ebooksCollection.updateOne(
        { _id: new ObjectId(ebookId) },
        { $set: { status: "Sold" } },
      );
    }

    console.log(
      `[Simulated Email] Sent to ${userEmail}: Payment of $${amount} for ${type} was successful. Transaction ID: ${session_id}`,
    );

    res.send({ success: true, transaction: txRecord });
  } catch (err) {
    res
      .status(500)
      .send({ message: "Payment verification failed", error: err.message });
  }
});

app.patch("/api/users/role", verifyToken, async (req, res) => {
  const { role } = req.body;
  if (role !== "user" && role !== "writer") {
    return res.status(400).send({ message: "Invalid role choice" });
  }

  try {
    const query = { _id: req.user._id };
    const updateDoc = {
      $set: { role: role },
    };
    const result = await usersCollection.updateOne(query, updateDoc);
    res.send({ success: true, message: `Role updated to ${role}`, result });
  } catch (err) {
    res.status(500).send({ message: "Error updating role" });
  }
});

app.post("/api/bookmarks", verifyToken, async (req, res) => {
  const { ebookId } = req.body;
  if (!ebookId) {
    return res.status(400).send({ message: "Ebook ID required" });
  }

  try {
    const existingBookmark = await bookmarksCollection.findOne({
      userId: req.user._id.toString(),
      ebookId: ebookId,
    });

    if (existingBookmark) {
      return res.status(400).send({ message: "Ebook already bookmarked" });
    }

    const ebook = await ebooksCollection.findOne({
      _id: new ObjectId(ebookId),
    });
    if (!ebook) {
      return res.status(404).send({ message: "Ebook not found" });
    }

    const bookmark = {
      userId: req.user._id.toString(),
      ebookId: ebookId,
      ebookTitle: ebook.title,
      ebookCover: ebook.coverImage,
      ebookPrice: ebook.price,
      ebookGenre: ebook.genre,
      ebookWriter: ebook.writerName,
      createdAt: new Date(),
    };

    const result = await bookmarksCollection.insertOne(bookmark);
    res.status(201).send(result);
  } catch (err) {
    res
      .status(500)
      .send({ message: "Error adding bookmark", error: err.message });
  }
});

app.get("/api/bookmarks", verifyToken, async (req, res) => {
  try {
    const query = { userId: req.user._id.toString() };
    const bookmarks = await bookmarksCollection.find(query).toArray();
    res.send(bookmarks);
  } catch (err) {
    res.status(500).send({ message: "Error loading bookmarks" });
  }
});

app.delete("/api/bookmarks/:ebookId", verifyToken, async (req, res) => {
  const ebookId = req.params.ebookId;
  try {
    const query = {
      userId: req.user._id.toString(),
      ebookId: ebookId,
    };
    const result = await bookmarksCollection.deleteOne(query);
    if (result.deletedCount === 0) {
      try {
        const result2 = await bookmarksCollection.deleteOne({
          _id: new ObjectId(ebookId),
          userId: req.user._id.toString(),
        });
        return res.send(result2);
      } catch (e) {}
    }
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: "Error removing bookmark" });
  }
});

app.get("/api/user/purchases", verifyToken, async (req, res) => {
  try {
    const purchases = await transactionsCollection
      .find({ buyerEmail: req.user.email, type: "purchase" })
      .sort({ createdAt: -1 })
      .toArray();
    res.send(purchases);
  } catch (err) {
    res.status(500).send({ message: "Error loading purchase history" });
  }
});

app.get("/api/user/purchased-ebooks", verifyToken, async (req, res) => {
  try {
    const purchases = await transactionsCollection
      .find({ buyerEmail: req.user.email, type: "purchase" })
      .toArray();

    const ebookIds = purchases
      .filter((p) => p.ebookId)
      .map((p) => new ObjectId(p.ebookId));

    if (ebookIds.length === 0) {
      return res.send([]);
    }

    const ebooks = await ebooksCollection
      .find({ _id: { $in: ebookIds } })
      .toArray();
    res.send(ebooks);
  } catch (err) {
    res.status(500).send({ message: "Error loading purchased ebooks" });
  }
});

app.post("/api/transactions", verifyToken, async (req, res) => {
  const { transactionId, type, ebookId, buyerEmail, writerEmail, amount } =
    req.body;

  const txRecord = {
    transactionId,
    type,
    ebookId: ebookId || null,
    buyerEmail,
    writerEmail: writerEmail || null,
    amount: parseFloat(amount),
    createdAt: new Date(),
  };

  try {
    const result = await transactionsCollection.insertOne(txRecord);

    if (type === "publishing fee") {
      await usersCollection.updateOne(
        { email: buyerEmail },
        { $set: { verifiedWriter: true } },
      );
    } else if (type === "purchase" && ebookId) {
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

app.get("/api/admin/users", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const users = await usersCollection.find().toArray();
    res.send(users);
  } catch (err) {
    res.status(500).send({ message: "Error loading system users list" });
  }
});

app.patch(
  "/api/admin/users/:id/role",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const id = req.params.id;
      const { role } = req.body;

      const query = { $or: [{ _id: id }, { id: id }] };
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

app.delete(
  "/api/admin/users/:id",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const id = req.params.id;
      const query = { $or: [{ _id: id }, { id: id }] };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    } catch (err) {
      res.status(500).send({ message: "Error removing user" });
    }
  },
);

app.get("/api/admin/ebooks", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const ebooks = await ebooksCollection
      .find()
      .sort({ createdAt: -1 })
      .toArray();
    res.send(ebooks);
  } catch (err) {
    res
      .status(500)
      .send({ message: "Error loading all ebooks for administration" });
  }
});

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

app.get("/api/admin/analytics", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const totalUsers = await usersCollection.countDocuments();
    const totalWriters = await usersCollection.countDocuments({
      role: "writer",
    });
    const totalEbooks = await ebooksCollection.countDocuments();
    const totalSold = await ebooksCollection.countDocuments({ status: "Sold" });

    const revenueAggr = await transactionsCollection
      .aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }])
      .toArray();
    const totalRevenue = revenueAggr[0]?.total || 0;

    const genreAggr = await ebooksCollection
      .aggregate([{ $group: { _id: "$genre", count: { $sum: 1 } } }])
      .toArray();

    const salesAggr = await transactionsCollection
      .aggregate([
        { $match: { type: "purchase" } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            totalSales: { $sum: "$amount" },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray();

    res.send({
      totalUsers,
      totalWriters,
      totalEbooks,
      totalSold,
      totalRevenue,
      genreAnalytics: genreAggr,
      monthlySales: salesAggr,
    });
  } catch (err) {
    res.status(500).send({ message: "Error parsing ecosystem analytics" });
  }
});

app.listen(port, () => {
  console.log(`Fable Server listening on port ${port}`);
});

module.exports = app;
