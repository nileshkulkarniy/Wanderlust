const Listing = require("../models/listing");
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });

module.exports.index = async (req, res) => {
    const allListings = await Listing.find({});
    res.render("listings/index.ejs", { allListings });
};

module.exports.renderNewForm = (req, res) => {
    res.render("listings/new.ejs");
};

module.exports.showListing = async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id)
        .populate({
            path: "reviews",
            populate: { path: "author" } 
        })
        .populate("owner"); // Ensure the owner field is populated

    if (!listing || !listing.owner) {
        req.flash("error", "Listing does not exist or has no owner!");
        return res.redirect("/listings");
    }

    res.render("listings/show.ejs", { listing });
};


module.exports.createListing = async (req, res, next) => {
    try {
        let response = await geocodingClient.forwardGeocode({
            query: req.body.listing.location,
            limit: 1
        }).send();

        // Ensure we get valid geometry data
        if (!response.body.features.length) {
            req.flash("error", "Invalid location. Please enter a valid address.");
            return res.redirect("/listings/new");
        }

        let { center } = response.body.features[0]; // Extract coordinates
        let newListing = new Listing(req.body.listing);
        
        newListing.owner = req.user._id;
        newListing.image = { url: req.file.path, filename: req.file.filename };
        
        // Set geometry data properly
        newListing.geometry = {
            type: "Point",
            coordinates: center // Expected as [longitude, latitude]
        };

        await newListing.save();
        req.flash("success", "New Listing Created");
        res.redirect("/listings");
    } catch (err) {
        console.error("Error creating listing:", err);
        req.flash("error", "Something went wrong while creating the listing.");
        res.redirect("/listings/new");
    }
};


module.exports.renderEditForm = async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing not found!");
        return res.redirect("/listings");
    }

    let originalImageUrl = listing.image.url.replace("/upload", "/upload/w_250");
    res.render("listings/edit.ejs", { listing, originalImageUrl });
};

module.exports.updateListing = async (req, res) => {
    let { id } = req.params;
    let coordinate = await geocodingClient.forwardGeocode({
        query: `${req.body.listing.location},${req.body.listing.country}`,
        limit: 1
    }).send();

    req.body.listing.geometry = coordinate.body.features[0].geometry;
    let listing = await Listing.findByIdAndUpdate(id, { ...req.body.listing });

    if (req.file) {
        listing.image = { url: req.file.path, filename: req.file.filename };
        await listing.save();
    }

    req.flash("success", "Listing Updated");
    res.redirect(`/listings/${id}`);
};

module.exports.destroyListing = async (req, res) => {
    let { id } = req.params;
    await Listing.findByIdAndDelete(id);
    req.flash("success", "Listing Deleted");
    res.redirect("/listings");
};

module.exports.filterListings = async (req, res) => {
    const query = decodeURIComponent(req.params.q);
    console.log("Filter query received:", query);

    try {
        const allListings = await Listing.find({ category: { $regex: new RegExp("^" + query + "$", "i") } });

        if (allListings.length === 0) {
            req.flash("error", "No Listings found for this filter!");
            return res.redirect("/listings");
        }

        res.render("listings/index", { allListings });
    } catch (err) {
        console.error("Error fetching listings:", err);
        res.status(500).send("Server error");
    }
};

module.exports.search = async (req, res) => {
    console.log("🔍 Received search request:", req.query); // Debugging log

    const { q } = req.query;
    
    if (!q || q.trim() === "") {
        console.log("❌ Error: Search query is empty!"); // Debugging log
        req.flash("error", "Please enter a search term.");
        return res.redirect("/listings");
    }

    console.log("✅ Search Query:", q); // Log the actual search term

    try {
        const listings = await Listing.find({
            title: { $regex: q, $options: "i" } // Case-insensitive search
        });

        console.log("🔎 Listings found:", listings.length); // Debugging log

        if (listings.length === 0) {
            req.flash("error", "No listings found for your search.");
            return res.redirect("/listings");
        }

        res.render("listings/index", { allListings: listings });
    } catch (err) {
        console.error("⚠️ Error searching listings:", err);
        req.flash("error", "Something went wrong.");
        res.redirect("/listings");
    }
};
