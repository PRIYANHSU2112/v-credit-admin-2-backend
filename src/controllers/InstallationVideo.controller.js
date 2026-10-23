const InstallationVideo = require("../models/InstallationVideo.model.js");

const createInstallationVideo = async (req, res) => {
  try {
    const { title, description, channelName, youtubeLink } = req.body;
    if (!title) {
      return res
        .status(400)
        .json({ success: false, message: "Title is required" });
    }

    if (!req.files || !req.files.video) {
      return res
        .status(400)
        .json({ success: false, message: "Please upload a video file" });
    }
    console.log("inside contrller");
    const videoFile = req.files.video[0];
    const thumbnailFile = req.files.thumbnail ? req.files.thumbnail[0] : null;
    const videoPath = `uploads/${videoFile.filename}`;
    const thumbnailPath = thumbnailFile
      ? `uploads/${thumbnailFile.filename}`
      : null;
    const channelImage = req.files?.channelImage?.[0];
    const imageLocation = channelImage
      ? `uploads/${channelImage.filename}`
      : null;

    const newVideo = new InstallationVideo({
      title,
      description,
      channelName,
      channelImage: imageLocation,
      videoPath,
      thumbnail: thumbnailPath,
      youtubeLink,
      createdBy: req.userId || null,
    });

    await newVideo.save();

    res.status(201).json({
      success: true,
      message: "Video uploaded successfully",
      data: newVideo,
    });
  } catch (error) {
    console.error("Error uploading video:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

const getAllInstallationVideos = async (req, res) => {
  try {
    const videos = await InstallationVideo.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Videos fetched successfully",
      count: videos.length,
      data: videos,
    });
  } catch (error) {
    console.error("Error fetching videos:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const updateInstallationVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, channelName } = req.body;

    const updateData = {};
    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (channelName) updateData.channelName = channelName;

    // If video re-uploaded
    if (req.files?.video) {
      updateData.videoPath = `uploads/${req.files.video[0].filename}`;
    }

    // If thumbnail re-uploaded
    if (req.files?.thumbnail) {
      updateData.thumbnail = `uploads/${req.files.thumbnail[0].filename}`;
    }

    const updatedVideo = await InstallationVideo.findByIdAndUpdate(
      id,
      updateData,
      { new: true },
    );

    if (!updatedVideo) {
      return res.status(404).json({
        success: false,
        message: "Installation video not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Video updated successfully",
      data: updatedVideo,
    });
  } catch (error) {
    console.error("Error updating video:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const deleteInstallationVideo = async (req, res) => {
  try {
    const { id } = req.params;

    const video = await InstallationVideo.findByIdAndDelete(id);

    if (!video) {
      return res.status(404).json({
        success: false,
        message: "Installation video not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Video deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting video:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

module.exports = {
  createInstallationVideo,
  getAllInstallationVideos,
  updateInstallationVideo,
  deleteInstallationVideo,
};
