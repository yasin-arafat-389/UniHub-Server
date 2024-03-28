const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5001;

// Parsers
app.use(
  cors({
    origin: ["http://localhost:5173", "https://unihub-e8b67.web.app"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.qqtmocj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  const studentsCollection = client.db("UniHub").collection("students");
  const allCRCollection = client.db("UniHub").collection("allCR");
  const allActivitiesCollection = client.db("UniHub").collection("allActivity");
  const allTeamsCollection = client.db("UniHub").collection("allTeam");
  const memberRequestsCollection = client
    .db("UniHub")
    .collection("memberRequests");
  const alreadyJoinedCollection = client
    .db("UniHub")
    .collection("alreadyJoined");
  try {
    // Create new student
    app.post("/create/student", async (req, res) => {
      let studentInfo = req.body;

      let isAlreadyExists = await studentsCollection.findOne({
        email: studentInfo.email,
      });

      if (isAlreadyExists) {
        return res.send({ alreadyExists: true });
      }

      await studentsCollection.insertOne(studentInfo);
      res.send({ success: true });
    });

    // Get single student data
    app.get("/student/info", async (req, res) => {
      let email = req.query.email;
      let result = await studentsCollection.findOne({ email: email });
      res.send(result);
    });

    // Update student section
    app.post("/update/section", async (req, res) => {
      let identifier = req.body.id;
      let selectedSection = req.body.selectedSection;

      let id = new ObjectId(identifier);

      await studentsCollection.findOneAndUpdate(
        { _id: id },
        { $set: { selectedSection: selectedSection } },
        { returnOriginal: false }
      );

      res.send({ success: true });
    });

    // Insert CR requests
    app.post("/request/CR", async (req, res) => {
      let crInfo = req.body;

      let isRequestExists = await allCRCollection.findOne({
        section: crInfo.section,
      });

      if (isRequestExists) {
        return res.send({
          status: isRequestExists.status,
          name: isRequestExists.name,
        });
      }

      await allCRCollection.insertOne(crInfo);

      res.send({ success: true });
    });

    // Get CR status
    app.get("/cr/status", async (req, res) => {
      let email = req.query.email;
      let result = await allCRCollection.findOne({ email: email });
      res.send(result);
    });

    // Add new activity
    app.post("/add/activity", async (req, res) => {
      let activityInfo = req.body;
      await allActivitiesCollection.insertOne(activityInfo);
      res.send({ success: true });
    });

    // Get all activity
    app.get("/get/all-activity", async (req, res) => {
      let email = req.query.email;

      let section = await studentsCollection.findOne({ email: email });

      let result = await allActivitiesCollection
        .find({ section: section?.selectedSection })
        .toArray();

      res.json({ result, section: section.selectedSection });
    });

    // Get activity details
    app.get("/activity/details", async (req, res) => {
      let id = req.query.id;
      let activityId = new ObjectId(id);
      let result = await allActivitiesCollection.findOne({ _id: activityId });
      res.send(result);
    });

    // Insert new team data
    app.post("/add/new-team", async (req, res) => {
      let teamData = req.body;

      let isAlreadyExists = await allTeamsCollection.findOne({
        email: teamData.email,
        activityId: teamData.activityId,
      });

      if (isAlreadyExists) {
        return res.send({ exists: true });
      }

      await allTeamsCollection.insertOne(teamData);

      await alreadyJoinedCollection.insertOne({
        email: teamData.email,
        activityId: teamData.activityId,
      });

      res.send({ success: true });
    });

    // Get All tems
    app.get("/get/all-teams", async (req, res) => {
      let activityId = req.query.activityId;

      let result = await allTeamsCollection
        .find({ activityId: activityId })
        .toArray();

      res.send(result);
    });

    // Get single team details
    app.get("/team/details", async (req, res) => {
      let id = req.query.teamId;
      let teamId = new ObjectId(id);
      let result = await allTeamsCollection.findOne({ _id: teamId });
      res.send(result);
    });

    // Insert member request
    app.post("/request/to/join", async (req, res) => {
      let joiningInfo = req.body;

      let isAlreadyExists = await memberRequestsCollection.findOne({
        teamId: joiningInfo.teamId,
        email: joiningInfo.email,
      });

      if (isAlreadyExists?.status === "pending") {
        return res.send({ exists: true });
      }

      await memberRequestsCollection.insertOne(joiningInfo);
      res.send({ success: true });
    });

    // Get member requests
    app.get("/get/member-requests", async (req, res) => {
      let teamId = req.query.teamId;
      let result = await memberRequestsCollection
        .find({ teamId: teamId })
        .toArray();
      res.send(result);
    });

    // reject member request
    app.post("/reject/member-request", async (req, res) => {
      let id = req.query.id;
      let requestId = new ObjectId(id);
      await memberRequestsCollection.deleteOne({ _id: requestId });
      res.send({ success: true });
    });

    // accept member request
    app.post("/accept/member-request", async (req, res) => {
      let id = req.query.id;
      let teamId = req.query.teamId;
      let activityId = req.query.activityId;
      let email = req.query.email;

      let requestId = new ObjectId(id);
      let member = await memberRequestsCollection.findOne({ _id: requestId });

      let teamToJoin = new ObjectId(teamId);

      let name = member.name;
      let studentId = member.studentId;

      await allTeamsCollection.updateOne(
        { _id: teamToJoin },
        {
          $push: {
            teamMembers: {
              name: name,
              studentId: studentId,
              email,
              activityId,
            },
          },
        }
      );

      await memberRequestsCollection.deleteOne({ _id: requestId });

      await alreadyJoinedCollection.insertOne({
        email: email,
        activityId: activityId,
      });

      res.send({ success: true });
    });

    // Get already joined a team details
    app.get("/already/joined", async (req, res) => {
      let email = req.query.email;
      let activityId = req.query.activityId;

      let result = await alreadyJoinedCollection.findOne({
        email: email,
        activityId: activityId,
      });

      let result2 = await memberRequestsCollection.findOne({
        email: email,
        activityId: activityId,
      });

      if (result || result2) {
        return res.send({ exists: true });
      } else {
        return res.send({ exists: false });
      }
    });

    // Leave a team
    app.post("/leave/team", async (req, res) => {
      let { email, studentId, activityId } = req.body;

      let query = {
        activityId: activityId,
        "teamMembers.studentId": studentId,
      };

      let update = { $pull: { teamMembers: { studentId: studentId } } };

      await allTeamsCollection.updateOne(query, update);

      await alreadyJoinedCollection.deleteOne({
        email: email,
        activityId: activityId,
      });

      res.send({ success: true });
    });

    // Update team details
    app.post("/update/team-details", async (req, res) => {
      let { teamId, updatedTeamName, updatedTitle } = req.body;
      let id = new ObjectId(teamId);
      await allTeamsCollection.updateOne(
        { _id: id },
        { $set: { teamName: updatedTeamName, title: updatedTitle } }
      );

      res.send({ success: true });
    });

    // Remove a team member
    app.post("/remove/team-member", async (req, res) => {
      let { email, studentId, activityId } = req.body;

      let query = {
        activityId: activityId,
        "teamMembers.studentId": studentId,
      };

      let update = { $pull: { teamMembers: { studentId: studentId } } };

      await allTeamsCollection.updateOne(query, update);

      await alreadyJoinedCollection.deleteOne({
        email: email,
        activityId: activityId,
      });

      res.send({ success: true });
    });

    // Add new team resource
    app.post("/add/team-resource", async (req, res) => {
      let { teamId, title, link } = req.body;
      let id = new ObjectId(teamId);

      let team = await allTeamsCollection.findOne({ _id: id });

      if (!team) {
        return res
          .status(404)
          .send({ success: false, message: "Team not found" });
      }

      let teamResources = team.teamResources || [];

      function generateRandomIdentifier() {
        let identifier = "";
        for (let i = 0; i < 10; i++) {
          identifier += Math.floor(Math.random() * 10);
        }
        return identifier;
      }

      let newResource = { identifier: generateRandomIdentifier(), title, link };

      if (teamResources.length === 0) {
        await allTeamsCollection.updateOne(
          { _id: id },
          { $set: { teamResources: [newResource] } }
        );
      } else {
        await allTeamsCollection.updateOne(
          { _id: id },
          { $set: { teamResources: [...teamResources, newResource] } }
        );
      }

      res.send({ success: true });
    });

    // Update team resource
    app.post("/update/team-resource", async (req, res) => {
      let { teamId, title, link, identifier } = req.body;
      let id = new ObjectId(teamId);

      let team = await allTeamsCollection.findOne({ _id: id });

      let teamResources = team.teamResources || [];

      let resourceIndex = teamResources.findIndex(
        (resource) => resource.identifier === identifier
      );

      teamResources[resourceIndex].title = title;
      teamResources[resourceIndex].link = link;

      await allTeamsCollection.updateOne(
        { _id: id },
        { $set: { teamResources: teamResources } }
      );

      res.send({ success: true });
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is up and running");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
