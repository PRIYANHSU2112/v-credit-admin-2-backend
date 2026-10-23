const MobileBrandModel = require("../models/MobileBrand.model");
const MobileBrand = require("../models/MobileBrand.model");

const createBrand = async (req, res) => {
  try {
    const brand = await MobileBrand.create(req.body);
    res.status(201).json({ success: true, data: brand ,message:"brands created successfully"});
  } catch (error) {
    console.error("Error creating brand:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getAllBrands = async (req, res) => {
  try {
     const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || null
    const skip = (page - 1) * limit;
         
      const filter={};

      if(search?.trim()){

        filter.brandName={
         $regex:search.trim(),
         $options:'i'
        }
      }
  const brands = await MobileBrandModel.aggregate([
      {$match:filter}
      ,
      {
        $project: {
          brandName: 1
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
    const totalLoans = brands[0].totalCount[0]?.count || 0;
    const totalPages = Math.ceil(totalLoans / limit);

    const pagination = {
      total: totalLoans,
      totalPages: totalPages,
      currentPage: page,
    };

    res.status(200).json({ success: true, count: brands.length, data: brands[0]?.data ,pagination ,message:"brands fetched successfully"});
  } catch (error) {
    console.error("Error fetching brands:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getBrandById = async (req, res) => {
  try {
    const brand = await MobileBrand.findById(req.params.id);
    if (!brand)
      return res
        .status(404)
        .json({ success: false, message: "Brand not found" });
    res.status(200).json({ success: true, data: brand ,message:"brand fetched successfully"});
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const updateBrand = async (req, res) => {
  try {
    const brand = await MobileBrand.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!brand)
      return res
        .status(404)
        .json({ success: false, message: "Brand not found" });
    res.status(200).json({ success: true, data: brand , message:"brands update successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const deleteBrand = async (req, res) => {
  try {
    const brand = await MobileBrand.findByIdAndDelete(req.params.id);
    if (!brand)
      return res
        .status(404)
        .json({ success: false, message: "Brand not found" });
    res
      .status(200)
      .json({ success: true, message: "Brand deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  createBrand,
  getAllBrands,
  getBrandById,
  updateBrand,
  deleteBrand,
};
