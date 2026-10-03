/* Real client content goes here. Only add people who gave permission to be named
   and quotes they actually said. Empty sections stay hidden on the page.
   Any text can be a plain string or { nl: '...', en: '...' }.

   featured: [{ name, role, line, tags }]             big cards at the top
   roster:   [{ category, people: [{ name, role }] }]  grouped list
   quotes:   [{ name, role, text }]                   testimonials
*/
window.SOLACE_CLIENTS = {
  featured: [],
  roster: [
    {
      category: { nl: 'Profvoetbal', en: 'Professional football' },
      people: [
        { name: 'Sontje Hansen', role: { nl: 'Profvoetballer', en: 'Professional footballer' } },
        { name: 'Jaden Montnor', role: { nl: 'Profvoetballer', en: 'Professional footballer' } },
      ],
    },
  ],
  quotes: [],
};
