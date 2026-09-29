-- Run this in the Supabase SQL Editor. Adds English versions of the area,
-- description and amenities fields so the villas page and app show the
-- right language when switched to English (villa names are proper nouns
-- and stay the same in both languages). Safe to run once; also fixes the
-- Villa Jondal photo order after the hero photo was swapped locally.

alter table public.villas add column if not exists area_en text;
alter table public.villas add column if not exists description_en text;
alter table public.villas add column if not exists amenities_en text[] not null default '{}';

update public.villas set
  area_en = 'San Antonio',
  description_en = 'A modern two-floor retreat set behind bougainvillea and palms in San Antonio, built for large families or groups without compromising on privacy. The main house''s three bedrooms are joined by a self-contained two-bedroom annex, wrapped around a sun-drenched garden, private pool and shaded terrace. Inside, easy contemporary interiors meet a fully equipped kitchen, fireplace and smart TV throughout, with the buzz of San Rafael''s restaurants and Ibiza Town just minutes away.',
  amenities_en = array['Private swimming pool with sun terrace','Landscaped garden and shaded pergola lounge','Self-contained two-bedroom annex for extra privacy','Fully equipped kitchen with dishwasher and coffee machine','Air conditioning, central heating and fireplace','Barbecue and ping-pong table','5-minute walk to UNVRS club','Minutes from San Rafael village and Ibiza Town']
where name = 'Villa San Antonio';

update public.villas set
  area_en = 'Roca Llisa',
  description_en = 'Set within the gated community of Roca Llisa and overlooking the island''s golf course, Villa Nilo is a bold, contemporary retreat built for groups who want privacy without sacrificing energy. Bright open-plan living spaces flow out to a private pool, while a rooftop terrace with Jacuzzi, lounge and dining area takes in sweeping hill and countryside views. A separate club room with its own bar and DJ setup rounds out a villa equally suited to a quiet family week or an unforgettable weekend with friends.',
  amenities_en = array['Private swimming pool','Rooftop terrace with Jacuzzi, lounge and dining area','Separate club room with bar and DJ deck','Gated Roca Llisa community with golf course views','Bright, open-plan living and dining spaces','Landscaped garden with mature trees and bougainvillea','Private parking for multiple cars','Minutes from Ibiza Town, Santa Eulalia and Cala Olivera']
where name = 'Villa Nilo';

update public.villas set
  area_en = 'Es Canar, east coast',
  description_en = 'A contemporary retreat on Ibiza''s east coast, set on a sprawling plot amid pine forest. Clean architectural lines, double-height glazing and a lift connecting all three levels give this villa an effortless, resort-like flow. Guests enjoy a private gymnasium, a chill-out terrace framed by mature trees, and interiors bathed in natural light. Perfect for a party that wants space to spread out without ever feeling apart.',
  amenities_en = array['Heated private pool with sun terrace','Private gymnasium and lift access to all floors','Covered al fresco dining terrace with built-in BBQ','Fully equipped designer kitchen','Five en-suite double bedrooms, most with private terrace access','Second living area with relaxed lounge and home office corner','Air conditioning, Wi-Fi and sound system throughout','Private parking within a 17,300 m² pine-forest plot']
where name = 'Villa Alfa';

update public.villas set
  area_en = 'Talamanca, Jesús',
  description_en = 'A bold, art-filled villa in the sought-after Talamanca area, just minutes from Ibiza town. Spread across five characterful levels, the interiors mix vivid statement pieces and playful design with sun-drenched terraces overlooking open countryside and the old town skyline. A dramatic lacquered-red dining table sets the scene for glamorous evenings, while the pool terrace and its resident giraffe sculpture make for an unmistakable holiday backdrop. Ideal for a lively group after both beach days and Ibiza''s famed nightlife on its doorstep.',
  amenities_en = array['Private pool with sun terrace and countryside views','Five minutes from Ibiza town and Pacha','Walking distance to Talamanca Beach','Striking dining terrace with statement lacquered table, seats 12+','Seven bedrooms across five levels, six with double beds','Bold, gallery-style interiors with original art throughout','Fully fitted kitchen','Multiple lounge and chill-out areas, indoors and out']
where name = 'Villa Prada';

update public.villas set
  area_en = 'Cala Jondal',
  description_en = 'Set high above a private cove in Cala Jondal, Villa Jondal is a sprawling estate spread across three separate buildings connected by tropical gardens, stone pathways and sweeping lawns. Inside, en-suite bedrooms and soaring living spaces mix historic character with contemporary design, furnished with commissioned artwork and pieces gathered from the owners'' travels. Beyond the two swimming pools, guests find a private wellness pavilion, a fully equipped gym, an outdoor kitchen and even a private club room, all serviced by full-time staff in the manner of a boutique hotel. Just minutes from Ibiza''s most celebrated restaurants and clubs, it is a residence built equally for quiet family retreats and for hosting in style.',
  amenities_en = array['Two swimming pools with panoramic sea views','Direct access to the beach below the property','Private wellness pavilion with massage treatments','Fully equipped outdoor gym','Al fresco dining pavilion seating up to 80 guests','Private club-style entertainment lounge with bar','Outdoor kitchen and barbecue pavilion','Manicured tropical gardens with Balinese-style lounging areas','Parking for 20 cars'],
  photo_path = 'https://solaceexecutive.com/assets/photos/villas/villa-jondal/hero.jpg',
  photos = array['https://solaceexecutive.com/assets/photos/villas/villa-jondal/hero.jpg','https://solaceexecutive.com/assets/photos/villas/villa-jondal/pool.jpg','https://solaceexecutive.com/assets/photos/villas/villa-jondal/living-room.jpg','https://solaceexecutive.com/assets/photos/villas/villa-jondal/dining-terrace.jpg','https://solaceexecutive.com/assets/photos/villas/villa-jondal/bedroom-1.jpg','https://solaceexecutive.com/assets/photos/villas/villa-jondal/bedroom-2.jpg','https://solaceexecutive.com/assets/photos/villas/villa-jondal/bathroom.jpg','https://solaceexecutive.com/assets/photos/villas/villa-jondal/spa.jpg','https://solaceexecutive.com/assets/photos/villas/villa-jondal/terrace.jpg','https://solaceexecutive.com/assets/photos/villas/villa-jondal/view.jpg']
where name = 'Villa Jondal';

update public.villas set
  area_en = 'Can Sire, near Jesús / Ibiza Town',
  description_en = 'A modern, minimalist villa in a quiet residential pocket just three kilometres from Ibiza Town, close enough to walk into the island''s nightlife yet private behind its own fenced garden. Spacious, light-filled rooms open onto a fenced pool terrace with a Balinese daybed and several chill-out corners, built for a group of friends or family who want room to spread out.',
  amenities_en = array['Private pool and fenced garden','Balinese daybed and chill-out areas','Air conditioning throughout','Private parking for 2-3 cars','Fully equipped kitchen','Quiet residential setting, no through traffic','3km from Ibiza Town and its nightlife']
where name = 'Villa Majestic';

update public.villas set
  area_en = 'South Ibiza',
  description_en = 'Set within a walled and gated 25,000 sqm private estate on the south side of Ibiza, this is one of the island''s largest and most complete country properties, pairing centuries-old Ibicenco character with uncompromising modern comfort. Ten sumptuous suites, sweeping landscaped gardens and a resort-scale outdoor club anchor a property built for total privacy and effortless entertaining, all set to views over pine forest, the Mediterranean and Formentera. From the heated pool and tennis court to a private music room with its own DJ booth, every detail is tuned for long, unhurried stays with family or friends.',
  amenities_en = array['Heated saltwater pool with a separate outdoor jacuzzi and glass-edged sun terrace','Full-size tennis court (resurfaced 2020) and a dedicated petanque court','Private wellness suite with infrared sauna, steam room and a Technogym-equipped fitness room','"The Club": a private music room with dance floor, bar, DJ booth and professional Pioneer sound system','Covered outdoor dining pavilion seating up to 30 guests, plus a full professional outdoor kitchen','In-house private chef and sommelier service available on request','Separate guesthouse with 3 additional en-suite bedrooms, decorated in a more contemporary style','Sweeping, designer-landscaped grounds (Wirtz-inspired) with century-old olive, oak and pine trees','Fully walled 25,000 sqm private estate with secure perimeter fencing','High-speed fiber Wi-Fi and underfloor heating throughout, air conditioning in every room']
where name = 'Hacienda Puig Redo';

update public.villas set
  area_en = 'Rural Ibiza',
  description_en = 'Can Bellotera sits on a five-thousand-square-metre countryside plot, its terracotta roofline and arched colonnade framed by orange groves and open hills. Inside, sun-washed lounges and terracotta-floored living spaces flow out to wraparound terraces and a sweeping stone pool deck. With five double bedrooms and a private guest apartment sleeping fourteen in total, it suits a large family or group wanting space, quiet, and a genuine slice of rural Ibiza.',
  amenities_en = array['Large private pool set in a lawned garden with sun loungers','Air conditioning throughout every bedroom','Three separate lounges plus a dedicated dining room','Two fully equipped kitchens','Covered terraces and balconies with countryside and hill views','Outdoor barbecue area','Wi-Fi and in-room safe','Surrounded by orange and olive groves for total privacy']
where name = 'Can Bellotera';

update public.villas set
  area_en = 'Can Furnet',
  description_en = 'Perched above Ibiza Town in Can Furnet, Villa Deseo pairs eight elegant en-suite bedrooms with a laguna-style pool set apart from the main house for total privacy, all wrapped in seventeen thousand square metres of gardens and pine woodland. Two vast terraces host alfresco dining for sixteen beneath woven pendant lights, while a rooftop jacuzzi and a private tennis court round out a property with no adjoining neighbours in sight. Unbroken views stretch to Dalt Vila, Formentera and the port, making it a rare combination of proximity to the city and complete seclusion.',
  amenities_en = array['Laguna-style infinity pool, detached from the house for extra privacy','Rooftop jacuzzi for sunset views before a night out','Private full-size tennis / basketball court','Wood-fired oven for pizzas and asados','Alfresco dining table seating up to 16, plus billiards table and grand piano','Panoramic views of Dalt Vila, Formentera and the port','Concierge service and daily cleaning included','Totally private with no adjoining neighbours, 5 minutes from Ibiza Town and Pacha']
where name = 'Villa Deseo';
