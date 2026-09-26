module.exports = async function handler(req, res) {
    const { slug } = req.query;
    
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

    if (!slug || slug === 'default') {
        return res.status(200).json(defaultManifest);
    }

    try {
        const SUPABASE_URL = "https://jtonmfevmcmnkmdjmubn.supabase.co";
        const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0b25tZmV2bWNtbmttZGptdWJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNTE0MDMsImV4cCI6MjEwNTgyNzQwM30.SLrkoolgzsCVgLW2XJusgh1QCSYMPrq2TzppYK1irgs";

        const response = await fetch(`${SUPABASE_URL}/rest/v1/businesses?slug=eq.${slug}&select=name,logo_url`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        const data = await response.json();
        
        if (data && data.length > 0) {
            const biz = data[0];
            const logo = biz.logo_url || "/logo_square.png";
            
            return res.status(200).json({
                name: biz.name || "Booking",
                short_name: biz.name || "Booking",
                display: "standalone",
                background_color: "#000000",
                theme_color: "#000000",
                icons: [
                    { src: logo, sizes: "192x192", type: "image/png" },
                    { src: logo, sizes: "512x512", type: "image/png" }
                ]
            });
        }
    } catch (err) {
        // Fallback gracefully on error
    }
    
    return res.status(200).json(defaultManifest);
};
