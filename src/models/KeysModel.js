const mongoose = require("mongoose");
const User = require("./UserModel");

const keysSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    requestKeys: {
      type: Number,
      default: 0,
    },
    code: { type: String, trim: true },
    batchId: { type: String, trim: true },
    reason: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

keysSchema.pre("findOneAndUpdate", async function (next) {
  try {
    const session = this.getOptions().session;
    const update = this.getUpdate();
    if (!update) return next();

    const payload = update.$set ? update.$set : update;
    const filter = this.getQuery();
    const oldDoc = await this.model.findOne(filter).session(session || null);
    if (!oldDoc) return next();

    const userFilter = { _id: oldDoc.userId };

    if (payload.status === "Approved" && oldDoc.status !== "Approved") {
      await User.findOneAndUpdate(
        userFilter,
        { $inc: { keys: oldDoc.requestKeys } },
        { session: session || undefined, new: true },
      );
    }

    if (payload.status === "Rejected" && oldDoc.status === "Approved") {
      await User.findOneAndUpdate(
        userFilter,
        { $inc: { keys: -oldDoc.requestKeys } },
        { session: session || undefined, new: true },
      );
    }

    return next();
  } catch (err) {
    return next(err);
  }
});
module.exports = mongoose.model("Keys", keysSchema);
