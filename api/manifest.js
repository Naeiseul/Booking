module.exports = async function handler(req, res) {
    // 1. Remove the dynamic RPC fetching for the manifest
    // 2. We unconditionally use the Logtraq logo (logo_square.png) for the PWA install
    // 3. We set a standard cache control so it loads fast but doesn't get stuck forever
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

    const defaultManifest = {
        name: "Logtraq Booking",
        short_name: "Booking",
        display: "standalone",
        background_color: "#000000",
        theme_color: "#000000",
        icons: [
            { src: "/logo_square.png", sizes: "192x192", type: "image/png" },
            { src: "/logo_square.png", sizes: "512x512", type: "image/png" }
        ]
    };
    
    return res.status(200).json(defaultManifest);
};
