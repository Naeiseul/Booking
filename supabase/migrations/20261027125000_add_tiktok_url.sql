-- Add an optional TikTok profile link beside the existing social links.
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS tiktok_url text;

CREATE OR REPLACE FUNCTION public.get_public_page(p_slug text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_business record;
    v_slots json;
BEGIN
    SELECT id, name, whatsapp_number, last_updated_at, logo_url,
           instagram_url, facebook_url, tiktok_url
    INTO v_business
    FROM public.businesses WHERE slug = p_slug;

    IF v_business.id IS NULL THEN RETURN NULL; END IF;

    SELECT COALESCE(json_agg(json_build_object('date', slot_date, 'time', slot_time)), '[]'::json)
    INTO v_slots
    FROM public.availability
    WHERE business_id = v_business.id AND status = 'open' AND slot_date >= CURRENT_DATE;

    RETURN json_build_object(
        'name', v_business.name,
        'whatsapp_number', v_business.whatsapp_number,
        'last_updated_at', v_business.last_updated_at,
        'logo_url', v_business.logo_url,
        'instagram_url', v_business.instagram_url,
        'facebook_url', v_business.facebook_url,
        'tiktok_url', v_business.tiktok_url,
        'slots', v_slots
    );
END;
$function$;
