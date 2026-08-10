// Wikipedia Special:FilePath auto-resolves to the current image — no hash prefix needed.
export const wiki = (file: string) => `https://commons.wikimedia.org/wiki/Special:FilePath/${file}?width=800`;

// Each legend has MULTIPLE photos AND MULTIPLE quotes.
// Every day: person + photo + quote all rotate independently → always a fresh combo, never the same card twice in a row.
export const LEGENDS: { p: string; imgs: string[]; qs: string[] }[] = [
  { p: "SHAH RUKH KHAN", imgs: ["Shah_Rukh_Khan_graces_the_launch_of_the_new_Santro.jpg", "Shah_Rukh_Khan_2014.jpg", "Shah_Rukh_Khan_at_the_Ra.One_Music_Launch.jpg"].map(wiki),
    qs: ["Success is not a good teacher, failure makes you humble.", "I am a self-made man. And it is my hard work that has made me what I am today.", "Never give up. Have faith in yourself.", "Dreams are the ones that don't let you sleep."] },
  { p: "DAVID GOGGINS", imgs: ["David_Goggins_2024.jpg", "David_Goggins_2013.jpg"].map(wiki),
    qs: ["When your alarm goes off — that split second — that is the exact moment your character is being defined.", "You are in danger of living a life so comfortable and soft that you will die without ever realizing your true potential.", "The only way you gain mental toughness is to do things you're not happy doing.", "Suffering is the true test of life."] },
  { p: "KOBE BRYANT", imgs: ["Kobe_Bryant_2014.jpg", "Kobe_Bryant_8.jpg", "Kobe_Bryant_2010.jpg"].map(wiki),
    qs: ["Everything negative — pressure, challenges — is all an opportunity for me to rise.", "The most important thing is to try and inspire people so that they can be great in whatever they want to do.", "Great things come from hard work and perseverance. No excuses.", "Rest at the end, not in the middle."] },
  { p: "MICHAEL JORDAN", imgs: ["Michael_Jordan_in_2014.jpg", "Michael-Jordan.jpg"].map(wiki),
    qs: ["I've failed over and over again in my life. And that is why I succeed.", "I can accept failure, everyone fails at something. But I can't accept not trying.", "Some people want it to happen, some wish it would happen, others make it happen.", "Talent wins games, but teamwork and intelligence win championships."] },
  { p: "BRUCE LEE", imgs: ["Bruce_Lee_1973.jpg", "Bruce_Lee_As_Kato_1967.jpg"].map(wiki),
    qs: ["Do not pray for an easy life, pray for the strength to endure a difficult one.", "Absorb what is useful, discard what is not, add what is uniquely your own.", "The successful warrior is the average man, with laser-like focus.", "Knowing is not enough, we must apply. Willing is not enough, we must do."] },
  { p: "ELON MUSK", imgs: ["Elon_Musk_Colorado_2022_(cropped2).jpg", "Elon_Musk_Royal_Society_(crop2).jpg"].map(wiki),
    qs: ["When something is important enough, you do it even if the odds are not in your favor.", "Failure is an option here. If things are not failing, you are not innovating enough.", "Persistence is very important. You should not give up unless you are forced to give up.", "The first step is to establish that something is possible; then probability will occur."] },
  { p: "ARNOLD SCHWARZENEGGER", imgs: ["Governor_Arnold_Schwarzenegger.jpg", "Arnold_Schwarzenegger_by_Gage_Skidmore_4.jpg"].map(wiki),
    qs: ["The mind is the limit. As long as the mind can envision it, you can do it.", "Strength does not come from winning. Your struggles develop your strengths.", "The worst thing I can be is the same as everybody else. I hate that.", "The last three or four reps is what makes the muscle grow."] },
  { p: "MUHAMMAD ALI", imgs: ["Muhammad_Ali_NYWTS.jpg", "Muhammad_Ali_1966.jpg"].map(wiki),
    qs: ["Don't count the days, make the days count.", "I hated every minute of training, but I said, 'Suffer now and live the rest of your life as a champion.'", "He who is not courageous enough to take risks will accomplish nothing in life.", "Impossible is just a word thrown around by small men."] },
  { p: "STEVE JOBS", imgs: ["Steve_Jobs_Headshot_2010-CROP_(cropped_2).jpg", "Steve_Jobs_1955-2011.jpg"].map(wiki),
    qs: ["Your time is limited, so don't waste it living someone else's life.", "Stay hungry, stay foolish.", "Innovation distinguishes between a leader and a follower.", "The only way to do great work is to love what you do."] },
  { p: "CRISTIANO RONALDO", imgs: ["Cristiano_Ronaldo_2018.jpg", "Cristiano_Ronaldo_playing_for_Al_Nassr_FC_against_Persepolis,_September_2023_(cropped).jpg"].map(wiki),
    qs: ["Talent without working hard is nothing.", "Your love makes me strong, your hate makes me unstoppable.", "I'm living a dream I never want to wake up from.", "Dedication, hard work all the time, and belief."] },
  { p: "LIONEL MESSI", imgs: ["Lionel_Messi_20180626.jpg", "Lionel-Messi-Argentina-2022-FIFA-World-Cup_(cropped).jpg"].map(wiki),
    qs: ["You have to fight to reach your dream. You have to sacrifice and work hard for it.", "It took me 17 years and 114 days to become an overnight success.", "The best decisions aren't made with your mind, but with your instinct.", "You can overcome anything, if and only if you love something enough."] },
  { p: "VIRAT KOHLI", imgs: ["Virat_Kohli_in_PMO_New_Delhi.jpg", "Virat_Kohli_January_2023_(cropped).jpg"].map(wiki),
    qs: ["Self-belief and hard work will always earn you success.", "You have to just concentrate on things you can control.", "If you chase perfection, you catch excellence.", "I want to leave a legacy for people who watch me play cricket."] },
  { p: "MS DHONI", imgs: ["MS_Dhoni_January_2016_(cropped).jpg", "Dhoni_stumping_a_batsman_(cropped).jpg"].map(wiki),
    qs: ["You can't ask for the process to be right and the result to also go in your favour every time.", "Never let success get to your head and never let failure get to your heart.", "Yes, I do get emotional. That's how you know you are alive.", "I don't ever want people to say I did something for my personal gain."] },
  { p: "SACHIN TENDULKAR", imgs: ["Sachin_at_Castrol_Golden_Spanner_Awards_(crop).jpg", "Sachin_Tendulkar_in_July_2023.jpg"].map(wiki),
    qs: ["I have played every match as if it was my last one.", "Chase your dreams, but always know the road that will lead you home again.", "When people throw stones at you, you turn them into milestones.", "Discipline and consistency have taken me where I am today."] },
  { p: "RATAN TATA", imgs: ["Ratan_Tata_-_World_Economic_Forum_Annual_Meeting_2011.jpg", "Ratan_Tata_in_Vancouver.jpg"].map(wiki),
    qs: ["I don't believe in taking right decisions. I take decisions and then make them right.", "If you want to walk fast, walk alone. If you want to walk far, walk together.", "None can destroy iron, but its own rust can. Likewise, none can destroy a person, but their own mindset can.", "Take the stones people throw at you, and use them to build a monument."] },
  { p: "A.P.J. ABDUL KALAM", imgs: ["A._P._J._Abdul_Kalam.jpg", "A._P._J._Abdul_Kalam_in_2008.jpg"].map(wiki),
    qs: ["Dream is not that which you see while sleeping, it is something that does not let you sleep.", "You have to dream before your dreams can come true.", "If you want to shine like a sun, first burn like a sun.", "Man needs difficulties in life because they are necessary to enjoy success."] },
  { p: "NELSON MANDELA", imgs: ["Nelson_Mandela-2008_(edit).jpg", "Nelson_Mandela_1994.jpg"].map(wiki),
    qs: ["It always seems impossible until it's done.", "I learned that courage was not the absence of fear, but the triumph over it.", "The greatest glory in living lies not in never falling, but in rising every time we fall.", "Do not judge me by my successes, judge me by how many times I fell down and got back up again."] },
  { p: "ALBERT EINSTEIN", imgs: ["Einstein_1921_by_F_Schmutzer_-_restoration.jpg", "Albert_Einstein_1947.jpg"].map(wiki),
    qs: ["Strive not to be a success, but rather to be of value.", "In the middle of difficulty lies opportunity.", "A person who never made a mistake never tried anything new.", "Life is like riding a bicycle. To keep your balance, you must keep moving."] },
  { p: "WARREN BUFFETT", imgs: ["Warren_Buffett_KU_Visit.jpg", "Warren_Buffett_at_the_2015_SelectUSA_Investment_Summit.jpg"].map(wiki),
    qs: ["The more you learn, the more you earn.", "It's better to hang out with people better than you.", "Someone is sitting in the shade today because someone planted a tree a long time ago.", "Risk comes from not knowing what you're doing."] },
  { p: "BILL GATES", imgs: ["Bill_Gates_2018.jpg", "Bill_Gates_2017_(cropped).jpg"].map(wiki),
    qs: ["It's fine to celebrate success but it is more important to heed the lessons of failure.", "Your most unhappy customers are your greatest source of learning.", "Patience is a key element of success.", "Don't compare yourself with anyone in this world. If you do, you are insulting yourself."] },
  { p: "JEFF BEZOS", imgs: ["Jeff_Bezos_2016.jpg", "Jeff_Bezos_at_Amazon_Spheres_Grand_Opening_in_Seattle_-_2018_(39074799225)_(cropped).jpg"].map(wiki),
    qs: ["If you decide that you're going to do only the things you know are going to work, you're going to leave a lot of opportunity on the table.", "Life is too short to hang out with people who are not resourceful.", "What we need to do is always lean into the future.", "In the end, we are our choices."] },
  { p: "MIKE TYSON", imgs: ["Mike_Tyson_2019_by_Glenn_Francis.jpg", "Mike_Tyson_20AUG09.jpg"].map(wiki),
    qs: ["Discipline is doing what you hate to do, but doing it like you love it.", "Everyone has a plan until they get punched in the mouth.", "I'm a dreamer. I have to dream and reach for the stars.", "My power is discombobulatingly devastating."] },
  { p: "CONOR McGREGOR", imgs: ["Conor_McGregor_2018.jpg", "Conor_McGregor_2015.jpg"].map(wiki),
    qs: ["There's no talent here, this is hard work. This is an obsession.", "We're not here to take part. We're here to take over.", "Doubt is only removed by action.", "If you can see it in your mind, you can hold it in your hand."] },
  { p: "DWAYNE JOHNSON", imgs: ["Dwayne_Johnson_2014_(cropped).jpg", "Dwayne_Johnson_2018.jpg"].map(wiki),
    qs: ["Success isn't always about greatness. It's about consistency.", "Be humble. Be hungry. And always be the hardest worker in the room.", "Wake up determined, go to bed satisfied.", "The wall is there to see how bad you want it."] },
  { p: "SYLVESTER STALLONE", imgs: ["Sylvester_Stallone_Cannes_2019.jpg", "Sylvester_Stallone_November_9,_2012.jpg"].map(wiki),
    qs: ["It ain't about how hard you hit. It's about how hard you can get hit and keep moving forward.", "Every champion was once a contender that refused to give up.", "I take rejection as someone blowing a bugle in my ear to wake me up.", "Life's not about how hard of a hit you can give. It's about how many you can take, and still keep moving forward."] },
  { p: "LEBRON JAMES", imgs: ["LeBron_James_%2851959977144%29_(cropped2).jpg", "LeBron_James_(15662939969)_(cropped).jpg"].map(wiki),
    qs: ["You have to be able to accept failure to get better.", "I like criticism. It makes you strong.", "Nothing is given. Everything is earned.", "I treated my body like a machine — I gave it the best fuel and worked it hard."] },
  { p: "USAIN BOLT", imgs: ["Usain_Bolt_Rio_100m_final_2016k.jpg", "Usain_Bolt_smiling_Berlin_2009.JPG"].map(wiki),
    qs: ["I trained four years to run nine seconds. People give up when they don't see results in two months.", "Kill them with success and bury them with a smile.", "I know what I can do, so it doesn't bother me what other people think.", "Dreams are free. Goals have a cost."] },
  { p: "NEYMAR JR", imgs: ["Bra-Cos_(6)_(cropped).jpg", "Neymar_-_MG_9061_(cropped).jpg"].map(wiki),
    qs: ["It is not about being the best. It is about being better than you were yesterday.", "In football, as in life, you must always keep fighting.", "Everything is possible if you believe.", "I want to be an athlete that people remember."] },
  { p: "TONY ROBBINS", imgs: ["Tony_Robbins_-_Unleash_the_Power_Within,_London_-_2019_(48918961658)_(cropped).jpg", "Tony_Robbins.jpg"].map(wiki),
    qs: ["The path to success is to take massive, determined action.", "Setting goals is the first step in turning the invisible into the visible.", "Where focus goes, energy flows.", "Beliefs have the power to create and the power to destroy."] },
  { p: "STEPHEN HAWKING", imgs: ["Stephen_Hawking.StarChild.jpg", "Stephen_Hawking_in_Cambridge.jpg"].map(wiki),
    qs: ["However difficult life may seem, there is always something you can do and succeed at.", "Intelligence is the ability to adapt to change.", "Look up at the stars and not down at your feet.", "Quiet people have the loudest minds."] },
];

// Fixed random-ish permutation so each day pulls a fresh (person, quote, photo) combo.
// The person cycles every LEGENDS.length days; the quote/photo indices also advance
// with the cycle count, so the same person+quote pair only recurs after many months.
export const rot = (s: number, m: number) => ((s % m) + m) % m;
export const dayCombo = (dayIdx: number) => {
  const n = LEGENDS.length;
  const cycle = Math.floor(dayIdx / n);
  const person = LEGENDS[rot(dayIdx * 7 + 3, n)];
  const q = person.qs[rot(dayIdx * 5 + 1 + cycle, person.qs.length)];
  const img = person.imgs[rot(dayIdx * 3 + 2 + cycle, person.imgs.length)];
  return { p: person.p, q, img };
};
