const MobileModel = require("../models/MobileModel.model");
const MobileBrand = require("../models/MobileBrand.model");

const createModel = async (req, res) => {
  try {
    const brandExists = await MobileBrand.findById(req.body.brandId);
    if (!brandExists)
      return res
        .status(404)
        .json({ success: false, message: "Brand not found" });

    const model = await MobileModel.create(req.body);
    res.status(201).json({ success: true, data: model ,message: "Model  created successfully" });
  } catch (error) {
    console.error("Error creating model:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getAllModels = async (req, res) => {
  try {
      const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || null
    const skip = (page - 1) * limit;
         
      const filter={};

      if(search?.trim()){

        filter.modelName={
         $regex:search.trim(),
         $options:'i'
        }
      }

    const models = await MobileModel.aggregate([
      {$match:filter}
      ,
      {
        $lookup: {
          from: "mobilebrands",
          localField: "brandId",
          foreignField: "_id",
          as: "brandDetails",
        },
      },
      { $unwind: "$brandDetails" },
      {
        $project: {
          modelName: 1,
          brandName: "$brandDetails.brandName",
        },
      },

            {
        $facet: {
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit }
          ],
          totalCount: [
            { $count: "count" }
          ]
        }
      }
    ]);
    const totalLoans = models[0].totalCount[0]?.count || 0;
    const totalPages = Math.ceil(totalLoans / limit);

    const pagination = {
      total: totalLoans,
      totalPages: totalPages,
      currentPage: page,
    };

    res.status(200).json({ success: true, count: models.length, data: models[0]?.data ,pagination ,
      message: "models Fetched successfully" 
    });
  } catch (error) {
    console.error("Error fetching models:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getModelById = async (req, res) => {
  try {
    const model = await MobileModel.findById(req.params.id).populate(
      "brandId",
      "brandName"
    );
    if (!model)
      return res
        .status(404)
        .json({ success: false, message: "Model not found" });
    res.status(200).json({ success: true, data: model ,message: "Model fetched successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const updateModel = async (req, res) => {
  try {
    const model = await MobileModel.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!model)
      return res
        .status(404)
        .json({ success: false, message: "Model not found" });
    res.status(200).json({ success: true, data: model ,message: "Model update successfully"});
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const deleteModel = async (req, res) => {
  try {
    const model = await MobileModel.findByIdAndDelete(req.params.id);
    if (!model)
      return res
        .status(404)
        .json({ success: false, message: "Model not found" });
    res
      .status(200)
      .json({ success: true, message: "Model deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  createModel,
  getAllModels,
  getModelById,
  updateModel,
  deleteModel,
};
