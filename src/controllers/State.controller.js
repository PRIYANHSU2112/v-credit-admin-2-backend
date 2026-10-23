const State = require("../models/State.model");

exports.createState = async (req, res) => {
  try {
    const { stateName } = req.body;

    const existingState = await State.findOne({ stateName: stateName.trim() });

    if (existingState) {
      return res.status(400).json({
        success: false,
        message: "State already exists",
      });
    }

    const state = await State.create({ stateName: stateName.trim() });

    return res.status(201).json({
      success: true,
      message: "State created successfully",
      data: state,
    });
  } catch (error) {
    console.error("Error creating state:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "State already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// exports.getAllStates = async (req, res) => {
//   try {
//     const statesWithCities = await State.aggregate([
//       {
//         $lookup: {
//           from: "cities",
//           localField: "_id",
//           foreignField: "stateId",
//           as: "cities",
//         },
//       },
//       {
//         $project: {
//           _id: 1,
//           stateName: 1,
//           "cities._id": 1,
//           "cities.cityName": 1,
//         },
//       },
//       { $sort: { stateName: 1 } },
//     ]);

//     res.status(200).json({
//       success: true,
//       count: statesWithCities.length,
//       data: statesWithCities,
//     });
//   } catch (error) {
//     console.error("Error fetching states with cities:", error);
//     res.status(500).json({
//       success: false,
//       message: "Internal server error",
//     });
//   }
// };

exports.getAllStates = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
       const search = req.query.search || undefined;
      const filter = {  };
    if (search) {

      filter.stateName = {
        $regex: search.trim(),
        $options: 'i'

      }
    }

    const totalStates = await State.countDocuments(filter);

    const statesWithCities = await State.aggregate([
      {$match:filter},
      {
        $lookup: {
          from: "cities",
          localField: "_id",
          foreignField: "stateId",
          as: "cities",
        },
      },
      {
        $project: {
          _id: 1,
          stateName: 1,
          "cities._id": 1,
          "cities.cityName": 1,
        },
      },
      { $sort: { stateName: 1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    const pagination = {
      currentPage: page,
      limit,
      totalPages: Math.ceil(totalStates / limit),
      totalStates,
      count: statesWithCities.length,
    };

    return res.status(200).json({
      success: true,
      pagination,
      data: statesWithCities,
      message: "States Fetched successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.updateState = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedState = await State.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (!updatedState)
      return res
        .status(404)
        .json({ success: false, message: "State not found" });

    res.status(200).json({ success: true, data: updatedState,message: "State Updated  successfully", });
  } catch (error) {
    console.error("Error updating state:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.deleteState = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedState = await State.findByIdAndDelete(id);
    if (!deletedState)
      return res
        .status(404)
        .json({ success: false, message: "State not found" });

    res
      .status(200)
      .json({ success: true, message: "State deleted successfully" });
  } catch (error) {
    console.error("Error deleting state:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};