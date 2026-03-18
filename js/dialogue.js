import { player } from './player.js';

// ─── Reputation tracking ───
if (player.reputation === undefined) player.reputation = 0;
if (player.foundLore === undefined) player.foundLore = [];

// ─── Dialogue Trees ───
const DIALOGUE_TREES = {
  'Мудрый Кактус': {
    start: {
      text: 'Привет, путник. Я вижу в тебе силу... но и наивность.',
      choices: [
        { text: 'Я ищу силу. Помоги мне.', next: 'quest_offer', condition: null },
        { text: 'Что ты знаешь о боссах?', next: 'lore_bosses', condition: null },
        { text: 'Можно ли тебе доверять?', next: 'trust', condition: null },
        { text: '[Украсть семечки]', next: 'steal_attempt', condition: { type: 'stat', stat: 'kills', min: 5 }, color: '#ff4444' },
      ]
    },
    quest_offer: {
      text: 'Убей 10 врагов, и я раскрою тебе тайну этих земель. Но помни — каждое убийство меняет тебя.',
      choices: [
        { text: 'Принимаю. Враги должны пасть.', next: null, action: { type: 'accept_quest', quest: 'kill', target: 10 } },
        { text: 'Нет, я пацифист.', next: 'pacifist', action: null },
      ]
    },
    lore_bosses: {
      text: 'Хрущ — древний жук-страж. Он охраняет эти холмы тысячелетиями. Но что-то свело его с ума... Шарлотта — королева крыс, изгнанная из подземного города за жестокость.',
      choices: [
        { text: 'Расскажи ещё.', next: 'lore_bosses_2' },
        { text: 'Мне достаточно.', next: null },
      ]
    },
    lore_bosses_2: {
      text: 'Карлуша, генерал ворон, строит армию на скалах. Мусорный Червь заразил свалку токсинами. Полковник Ножов ведёт военных на нашу землю. А Дюваль... о нём лучше не говорить.',
      choices: [
        { text: 'Кто такой Дюваль?', next: 'lore_bosses_3' },
        { text: 'Спасибо за информацию.', next: null, action: { type: 'give_xp', amount: 10 } },
      ]
    },
    lore_bosses_3: {
      text: 'Жан-Пьер Дюваль — безумный шеф-повар. Он превратил кухню в ад. Его ножи режут не только плоть — они режут саму реальность. Никто не возвращался оттуда живым.',
      choices: [
        { text: 'Я вернусь живым.', next: null, action: { type: 'give_xp', amount: 15 } },
        { text: 'Может, обойду его стороной...', next: null },
      ]
    },
    trust: {
      text: 'Доверие — роскошь в наше время. Я могу обмануть тебя. А могу спасти. Выбор за тобой.',
      choices: [
        { text: 'Я доверяю тебе.', next: 'quest_offer', action: { type: 'reputation', change: 5 } },
        { text: 'Я никому не доверяю.', next: 'distrust', action: { type: 'reputation', change: -3 } },
      ]
    },
    distrust: {
      text: 'Хм... умно. Может, ты выживешь дольше остальных. Ладно, вот квест. Без доверия. Просто бизнес.',
      choices: [
        { text: 'Давай.', next: null, action: { type: 'accept_quest', quest: 'kill', target: 10 } },
      ]
    },
    pacifist: {
      text: 'Пацифист? В ЭТОМ мире? Ха! Ладно, тогда принеси мне 20 семечек. Мирным путём.',
      choices: [
        { text: 'Договорились.', next: null, action: { type: 'accept_quest', quest: 'give', target: 20 } },
      ]
    },
    steal_attempt: {
      text: '*Ты незаметно тянешь руку к его карманам...*',
      choices: [
        { text: '...', next: null, action: { type: 'steal', successChance: 0.4, reward: 'seeds', amount: 10, failConsequence: 'hostile' } },
      ]
    },
    trade: {
      text: 'У меня есть кое-что для продажи. Кактусовый сок восстановит твои силы.',
      choices: [
        { text: 'Купить здоровье (10 семечек)', next: null, action: { type: 'trade', cost: 10, reward: 'hp', amount: 20 }, condition: { type: 'seeds', min: 10 } },
        { text: 'Нет, спасибо.', next: null },
      ]
    },
    companion_offer: {
      text: 'Хочешь, чтобы старый кактус пошёл с тобой? Мои иголки ещё остры! Но мне нужны 25 семечек на дорожные расходы.',
      choices: [
        { text: 'Вот семечки, идём! (25 семечек)', next: null, action: { type: 'hire_companion', cost: 25 }, condition: { type: 'seeds', min: 25 } },
        { text: 'Может позже.', next: null },
      ]
    },
  },

  'Старый Тыквос': {
    start: {
      text: 'Ох-хо-хо... Молодёжь. Вечно куда-то спешат. Сядь, послушай старика.',
      choices: [
        { text: 'Расскажи о прошлом.', next: 'lore_past' },
        { text: 'Мне нужны припасы.', next: 'trade' },
        { text: 'Пойдёшь со мной?', next: 'companion_ask', condition: { type: 'stat', stat: 'level', min: 3 } },
        { text: '[Обмануть — сказать что семечки фальшивые]', next: 'lie', color: '#ff4444' },
      ]
    },
    lore_past: {
      text: 'Когда-то здесь был великий фруктовый город. Арбузы, яблоки, груши — все жили в мире. Потом пришли насекомые. И всё рухнуло...',
      choices: [
        { text: 'Что случилось с городом?', next: 'lore_city' },
        { text: 'Почему насекомые напали?', next: 'lore_insects' },
      ]
    },
    lore_city: {
      text: 'Город пал. Остались только руины — говорят, под землёй ещё можно найти древние артефакты. Но никто не осмеливается спуститься...',
      choices: [
        { text: 'Расскажи про артефакты.', next: 'lore_artifacts' },
        { text: 'Я осмелюсь.', next: null, action: { type: 'give_xp', amount: 15 } },
        { text: 'Пока рано.', next: null },
      ]
    },
    lore_artifacts: {
      text: 'Древние тыквы хранили Семя Возрождения — артефакт, способный вернуть жизнь мёртвым землям. Говорят, оно спрятано в самом опасном биоме. Но это лишь легенда... или нет?',
      choices: [
        { text: 'Я найду его.', next: null, action: { type: 'give_xp', amount: 20 } },
        { text: 'Интересно... Спасибо.', next: null, action: { type: 'give_xp', amount: 10 } },
      ]
    },
    lore_insects: {
      text: 'Голод. Засуха. Они искали еду — и нашли нас. Мы были слишком добрыми, чтобы дать отпор сразу. Теперь расплачиваемся.',
      choices: [
        { text: 'Можно ли помириться с насекомыми?', next: 'lore_peace' },
        { text: 'Это больше не повторится.', next: null, action: { type: 'give_xp', amount: 15 } },
      ]
    },
    lore_peace: {
      text: 'Мир? С ними? Хм... Когда-то да, был мир. Но после предательства Хруща... Нет. Только сила решит этот конфликт. Или... может, ты найдёшь другой путь.',
      choices: [
        { text: 'Я попробую.', next: null, action: { type: 'reputation', change: 5 } },
        { text: 'Тогда — война.', next: null, action: { type: 'reputation', change: -2 } },
      ]
    },
    trade: {
      text: 'У меня есть кое-что. 15 семечек — и я дам тебе мудрость (стамина). 30 семечек — здоровье.',
      choices: [
        { text: 'Куплю стамину (15 семечек)', next: null, action: { type: 'trade', cost: 15, reward: 'stamina', amount: 20 }, condition: { type: 'seeds', min: 15 } },
        { text: 'Куплю здоровье (30 семечек)', next: null, action: { type: 'trade', cost: 30, reward: 'hp', amount: 25 }, condition: { type: 'seeds', min: 30 } },
        { text: 'Дороговато...', next: null },
      ]
    },
    companion_ask: {
      text: 'Хочешь, чтобы старый Тыквос пошёл с тобой? Хм... Я стар, но ещё могу дать хороший тыквенный удар! Но мне нужны 20 семечек на дорогу.',
      choices: [
        { text: 'Вот семечки, идём! (20 семечек)', next: null, action: { type: 'hire_companion', cost: 20 }, condition: { type: 'seeds', min: 20 } },
        { text: 'Может позже.', next: null },
      ]
    },
    lie: {
      text: '*Ты пытаешься убедить Тыквоса что его семечки — подделка...*',
      choices: [
        { text: '(Блеф)', next: null, action: { type: 'bluff', successChance: 0.3, reward: 'seeds', amount: 15, failConsequence: 'reputation_loss' } },
      ]
    },
  },

  'Грибочек': {
    start: {
      text: 'Пи-пи-пи! Привет! Я Грибочек! Маленький, но храбрый! Ну... почти храбрый...',
      choices: [
        { text: 'Тебе нужна помощь?', next: 'quest_offer' },
        { text: 'Расскажи о грибах.', next: 'lore_mushrooms' },
        { text: 'Есть что продать?', next: 'trade' },
        { text: '[Запугать — отдай всё!]', next: 'threaten', condition: { type: 'stat', stat: 'kills', min: 10 }, color: '#ff4444' },
      ]
    },
    quest_offer: {
      text: 'Б-б-босс этой локации... Он такой страшный! Пожалуйста, победи его! Я дам тебе свои грибные споры — они увеличат урон!',
      choices: [
        { text: 'Я разберусь с боссом.', next: null, action: { type: 'accept_quest', quest: 'boss', target: 1 } },
        { text: 'Мне нужно подготовиться.', next: 'prepare' },
      ]
    },
    prepare: {
      text: 'Д-да, подготовка — это важно! Я слышал, что босс боится огня. И ещё он атакует три раза подряд, потом отдыхает. Используй этот момент!',
      choices: [
        { text: 'Спасибо за совет. Я пойду.', next: null, action: { type: 'accept_quest', quest: 'boss', target: 1 } },
        { text: 'Расскажи ещё о его атаках.', next: 'prepare_2' },
      ]
    },
    prepare_2: {
      text: 'Он бьёт лапами, потом прыгает на тебя! Уворачивайся! А ещё... он иногда призывает маленьких помощников. Убей их первыми!',
      choices: [
        { text: 'Теперь я готов.', next: null, action: { type: 'accept_quest', quest: 'boss', target: 1 } },
      ]
    },
    lore_mushrooms: {
      text: 'Мы, грибы, живём везде! Под землёй, на деревьях, даже в ядовитых болотах! Наша сеть мицелия соединяет все биомы.',
      choices: [
        { text: 'Что за сеть мицелия?', next: 'lore_mycelium' },
        { text: 'Грибы в ядовитых болотах?', next: 'lore_toxic_shrooms' },
      ]
    },
    lore_mycelium: {
      text: 'Мицелий — это как... подземный интернет! Деревья общаются через нас. Мы передаём питательные вещества и... информацию. Я знаю всё, что происходит в лесу!',
      choices: [
        { text: 'Что ты знаешь о враге?', next: 'lore_enemy_info' },
        { text: 'Удивительно!', next: null, action: { type: 'give_xp', amount: 10 } },
      ]
    },
    lore_enemy_info: {
      text: 'Враги становятся сильнее с каждым биомом. Первый босс — лёгкий. Последний... Дюваль... он убил сотни. Но мицелий говорит, у тебя есть шанс. Маленький, но есть.',
      choices: [
        { text: 'Маленький шанс — это всё, что мне нужно.', next: null, action: { type: 'give_xp', amount: 15 } },
      ]
    },
    lore_toxic_shrooms: {
      text: 'Ядовитые болота... Там растут особые грибы. Они мутировали от токсинов. Некоторые стали опасны, другие — целебны. Если найдёшь фиолетовый гриб — не ешь его!',
      choices: [
        { text: 'А если красный?', next: 'lore_red_shroom' },
        { text: 'Понял, спасибо!', next: null, action: { type: 'give_xp', amount: 10 } },
      ]
    },
    lore_red_shroom: {
      text: 'Красный... как я? Ну, МЫ полезные! Красный гриб с белыми точками даёт временную суперсилу! Но потом ты будешь спать три дня... Хи-хи!',
      choices: [
        { text: 'Хаха, запомню.', next: null, action: { type: 'give_xp', amount: 5 } },
      ]
    },
    trade: {
      text: 'У меня есть грибные зелья! 12 семечек — зелье стамины. 25 семечек — зелье урона (временное усиление)!',
      choices: [
        { text: 'Куплю зелье стамины (12 семечек)', next: null, action: { type: 'trade', cost: 12, reward: 'stamina', amount: 25 }, condition: { type: 'seeds', min: 12 } },
        { text: 'Куплю зелье урона (25 семечек)', next: null, action: { type: 'trade', cost: 25, reward: 'damage', amount: 1 }, condition: { type: 'seeds', min: 25 } },
        { text: 'Мне не нужно.', next: null },
      ]
    },
    threaten: {
      text: '*Ты угрожающе нависаешь над маленьким Грибочком... Он дрожит...*',
      choices: [
        { text: 'Отдай всё, что у тебя есть!', next: null, action: { type: 'steal', successChance: 0.7, reward: 'seeds', amount: 8, failConsequence: 'hostile' } },
        { text: '...Прости, я пошутил.', next: 'apologize', action: { type: 'reputation', change: -5 } },
      ]
    },
    apologize: {
      text: 'П-пи... Ты напугал меня! Ладно... я прощаю. Но больше так не делай! Пожалуйста...',
      choices: [
        { text: 'Обещаю.', next: null, action: { type: 'reputation', change: 3 } },
      ]
    },
    companion_offer: {
      text: 'Т-ты хочешь, чтобы я пошёл с тобой?! Но я же маленький... Ладно! Грибочек будет храбрым! Мне нужно 15 семечек на маленький рюкзак!',
      choices: [
        { text: 'Вот семечки, маленький воин! (15 семечек)', next: null, action: { type: 'hire_companion', cost: 15 }, condition: { type: 'seeds', min: 15 } },
        { text: 'Лучше оставайся в безопасности.', next: null },
      ]
    },
  },

  'Морковка-ведунья': {
    start: {
      text: 'Хм-м-м... Я чувствую твою ауру, Арбузилла. Звёзды говорили мне о тебе.',
      choices: [
        { text: 'Что говорят звёзды?', next: 'prophecy' },
        { text: 'Мне нужен квест.', next: 'quest_offer' },
        { text: 'Продаёшь зелья?', next: 'trade' },
        { text: '[Украсть магический кристалл]', next: 'steal_crystal', condition: { type: 'stat', stat: 'kills', min: 15 }, color: '#ff4444' },
      ]
    },
    prophecy: {
      text: 'Я вижу шесть теней. Шесть стражей. Хрущ. Шарлотта. Карлуша. Червь. Ножов. Дюваль. Ты должен пройти через них всех...',
      choices: [
        { text: 'Я пройду.', next: 'prophecy_2' },
        { text: 'А что потом?', next: 'prophecy_after' },
      ]
    },
    prophecy_2: {
      text: 'Каждый страж хранит частицу древней силы. Когда соберёшь все шесть — мир изменится. Но не так, как ты ожидаешь...',
      choices: [
        { text: 'Что ты имеешь в виду?', next: 'prophecy_3' },
        { text: 'Я узнаю, когда придёт время.', next: null, action: { type: 'give_xp', amount: 15 } },
      ]
    },
    prophecy_3: {
      text: 'Победа над стражами не означает конец. Это начало. Древнее зло проснётся, когда падёт последний страж. Ты готов к этому?',
      choices: [
        { text: 'Я буду готов.', next: null, action: { type: 'give_xp', amount: 20 } },
        { text: 'Может, лучше не побеждать их...', next: 'prophecy_doubt' },
      ]
    },
    prophecy_doubt: {
      text: 'Нет. Выбора нет. Они уже знают о тебе. Бежать некуда. Только вперёд.',
      choices: [
        { text: 'Тогда вперёд.', next: null, action: { type: 'give_xp', amount: 10 } },
      ]
    },
    prophecy_after: {
      text: 'После... Древние тексты говорят о возрождении. Сады вернутся. Мир расцветёт. Но цена... цена будет высока.',
      choices: [
        { text: 'Какая цена?', next: 'prophecy_price' },
        { text: 'Неважно. Я заплачу.', next: null, action: { type: 'reputation', change: 3 } },
      ]
    },
    prophecy_price: {
      text: 'Этого я не вижу. Звёзды молчат. Но в каждой легенде герой чем-то жертвует. Подумай об этом.',
      choices: [
        { text: 'Я подумаю.', next: null, action: { type: 'give_xp', amount: 10 } },
      ]
    },
    quest_offer: {
      text: 'Мне нужно, чтобы ты уничтожил 20 врагов. Их энергия питает тьму. Каждый убитый враг ослабляет завесу зла.',
      choices: [
        { text: 'Принимаю вызов.', next: null, action: { type: 'accept_quest', quest: 'kill', target: 20 } },
        { text: 'Это слишком много.', next: 'quest_negotiate' },
      ]
    },
    quest_negotiate: {
      text: 'Хм... Ладно. 15 врагов. Но награда будет меньше. Судьба не любит лентяев.',
      choices: [
        { text: 'Хорошо, 15 врагов.', next: null, action: { type: 'accept_quest', quest: 'kill', target: 15 } },
        { text: 'Нет, давай 20. Я справлюсь.', next: null, action: { type: 'accept_quest', quest: 'kill', target: 20 } },
      ]
    },
    trade: {
      text: 'Мои зелья сварены под светом звёзд. 20 семечек — зелье скорости. 35 семечек — зелье ясновидения (больше урона).',
      choices: [
        { text: 'Куплю скорость (20 семечек)', next: null, action: { type: 'trade', cost: 20, reward: 'speed', amount: 0.5 }, condition: { type: 'seeds', min: 20 } },
        { text: 'Куплю урон (35 семечек)', next: null, action: { type: 'trade', cost: 35, reward: 'damage', amount: 1 }, condition: { type: 'seeds', min: 35 } },
        { text: 'Слишком дорого.', next: null },
      ]
    },
    steal_crystal: {
      text: '*Ты тянешься к светящемуся кристаллу в её сумке. Она закрыла глаза, читая заклинание...*',
      choices: [
        { text: '(Украсть)', next: null, action: { type: 'steal', successChance: 0.25, reward: 'seeds', amount: 20, failConsequence: 'hostile' } },
        { text: 'Нет, это слишком рискованно.', next: null },
      ]
    },
    companion_offer: {
      text: 'Звёзды говорят, что наши пути должны соединиться. За 30 семечек я пойду с тобой и буду предсказывать опасности.',
      choices: [
        { text: 'Идём вместе! (30 семечек)', next: null, action: { type: 'hire_companion', cost: 30 }, condition: { type: 'seeds', min: 30 } },
        { text: 'Пока нет.', next: null },
      ]
    },
  },

  'Баклажан-торговец': {
    start: {
      text: 'Добро пожаловать, добро пожаловать! Баклажан-торговец — лучшие товары по лучшим ценам! Ну, почти лучшим...',
      choices: [
        { text: 'Покажи товар.', next: 'trade' },
        { text: 'Откуда у тебя всё это?', next: 'lore_trade' },
        { text: 'У тебя есть работа для меня?', next: 'quest_offer' },
        { text: '[Ограбить лавку]', next: 'rob', condition: { type: 'stat', stat: 'kills', min: 20 }, color: '#ff4444' },
      ]
    },
    trade: {
      text: 'Вот мой ассортимент! Только лучшее для арбузного воина!',
      choices: [
        { text: 'Здоровье +30 (20 семечек)', next: null, action: { type: 'trade', cost: 20, reward: 'hp', amount: 30 }, condition: { type: 'seeds', min: 20 } },
        { text: 'Стамина +25 (18 семечек)', next: null, action: { type: 'trade', cost: 18, reward: 'stamina', amount: 25 }, condition: { type: 'seeds', min: 18 } },
        { text: 'Скорость +0.3 (25 семечек)', next: null, action: { type: 'trade', cost: 25, reward: 'speed', amount: 0.3 }, condition: { type: 'seeds', min: 25 } },
        { text: 'Посмотрю ещё.', next: 'trade_premium' },
      ]
    },
    trade_premium: {
      text: 'А вот эксклюзив! Для особых клиентов...',
      choices: [
        { text: 'Урон +1 (40 семечек)', next: null, action: { type: 'trade', cost: 40, reward: 'damage', amount: 1 }, condition: { type: 'seeds', min: 40 } },
        { text: 'Полное исцеление (50 семечек)', next: null, action: { type: 'trade', cost: 50, reward: 'full_heal', amount: 0 }, condition: { type: 'seeds', min: 50 } },
        { text: 'Нет, спасибо.', next: null },
      ]
    },
    lore_trade: {
      text: 'Я путешествую по всем биомам! Зелёные холмы, крысиные подземелья, вороньи скалы... Везде есть что купить и продать.',
      choices: [
        { text: 'Расскажи о подземельях.', next: 'lore_dungeons' },
        { text: 'Что за вороньи скалы?', next: 'lore_cliffs' },
        { text: 'Как ты выживаешь среди монстров?', next: 'lore_survival' },
      ]
    },
    lore_dungeons: {
      text: 'Крысиные подземелья... Жуткое место. Шарлотта контролирует каждый туннель. Но есть тайные проходы, которые она не знает. Я пользуюсь ими для торговли.',
      choices: [
        { text: 'Покажешь проходы?', next: 'lore_secret_paths' },
        { text: 'Расскажи о Шарлотте.', next: 'lore_charlotte' },
      ]
    },
    lore_secret_paths: {
      text: 'За информацию — 10 семечек. Бизнес есть бизнес!',
      choices: [
        { text: 'Вот семечки (10)', next: null, action: { type: 'trade', cost: 10, reward: 'xp', amount: 25 }, condition: { type: 'seeds', min: 10 } },
        { text: 'Жадина.', next: null },
      ]
    },
    lore_charlotte: {
      text: 'Шарлотта когда-то была обычной крысой. Нет, не обычной — она была принцессой. Яды изменили её разум. Теперь она видит врагов повсюду. Даже в своих подданных.',
      choices: [
        { text: 'Можно ли вылечить её?', next: 'lore_charlotte_cure' },
        { text: 'Спасибо.', next: null, action: { type: 'give_xp', amount: 10 } },
      ]
    },
    lore_charlotte_cure: {
      text: 'Вылечить? Хм... Говорят, где-то на свалке есть цветок, который очищает яд. Но Мусорный Червь охраняет его. Дилемма, а?',
      choices: [
        { text: 'Я найду этот цветок.', next: null, action: { type: 'give_xp', amount: 15 } },
      ]
    },
    lore_cliffs: {
      text: 'Вороньи скалы — высокие, ветреные, опасные. Карлуша — генерал. Он строит армию ворон. Зачем? Никто не знает. Но слухи ходят — он хочет завоевать ВСЕ биомы.',
      choices: [
        { text: 'Нужно остановить его.', next: null, action: { type: 'give_xp', amount: 10 } },
        { text: 'Ладно.', next: null },
      ]
    },
    lore_survival: {
      text: 'Секрет выживания торговца — нейтралитет! Я продаю ВСЕМ. Монстрам, боссам, даже Дювалю! Он, кстати, покупает у меня специи. Хе-хе.',
      choices: [
        { text: 'Ты торгуешь с врагами?!', next: 'lore_ethics' },
        { text: 'Умный подход.', next: null, action: { type: 'reputation', change: -2 } },
      ]
    },
    lore_ethics: {
      text: 'Эй, не осуждай! Семечки не пахнут! К тому же, через торговлю я узнаю их слабости. И могу продать ЭТУ информацию — тебе. За небольшую плату, конечно.',
      choices: [
        { text: 'Ладно, справедливо.', next: null, action: { type: 'give_xp', amount: 10 } },
        { text: 'Ты всё равно предатель.', next: null, action: { type: 'reputation', change: 3 } },
      ]
    },
    quest_offer: {
      text: 'Работа? Конечно! Принеси мне 30 семечек — инвестиция в мой бизнес. А я дам тебе постоянную скидку! Ну и здоровье в подарок.',
      choices: [
        { text: 'Договорились.', next: null, action: { type: 'accept_quest', quest: 'give', target: 30 } },
        { text: 'Слишком много.', next: 'quest_haggle' },
      ]
    },
    quest_haggle: {
      text: 'Хм, ладно... 25 семечек. Но награда будет поменьше! Последнее предложение!',
      choices: [
        { text: 'Идёт!', next: null, action: { type: 'accept_quest', quest: 'give', target: 25 } },
        { text: 'Нет, 30 — так 30.', next: null, action: { type: 'accept_quest', quest: 'give', target: 30 } },
      ]
    },
    rob: {
      text: '*Ты оглядываешься по сторонам. Баклажан считает семечки и не смотрит на тебя...*',
      choices: [
        { text: '(Ограбить)', next: null, action: { type: 'steal', successChance: 0.35, reward: 'seeds', amount: 25, failConsequence: 'hostile' } },
        { text: 'Не стоит.', next: null },
      ]
    },
    companion_offer: {
      text: 'Пойти с тобой? Хм... Это опасно для бизнеса. Но зато какие возможности для торговли в новых землях! 35 семечек — и я с тобой!',
      choices: [
        { text: 'Вот семечки! (35 семечек)', next: null, action: { type: 'hire_companion', cost: 35 }, condition: { type: 'seeds', min: 35 } },
        { text: 'Дорого.', next: null },
      ]
    },
  },
};

// ─── API Functions ───

export function getDialogueTree(npcName) {
  return DIALOGUE_TREES[npcName] || null;
}

export function checkCondition(condition, playerObj) {
  if (!condition) return true;
  const p = playerObj || player;

  switch (condition.type) {
    case 'stat':
      return (p[condition.stat] || 0) >= condition.min;
    case 'seeds':
      return p.seeds >= condition.min;
    case 'reputation':
      return (p.reputation || 0) >= condition.min;
    case 'level':
      return p.level >= condition.min;
    case 'quest_done':
      return condition.value === true;
    default:
      return true;
  }
}

export function executeAction(action, npc, playerObj) {
  if (!action) return { success: true, message: '' };
  const p = playerObj || player;

  switch (action.type) {
    case 'accept_quest': {
      if (npc) {
        npc.questAccepted = true;
        npc._killsAtAccept = p.kills;
        // Override quest params from dialogue
        if (npc.def && npc.def.quest) {
          npc.def.quest.type = action.quest;
          npc.def.quest.target = action.target;
          npc.def.quest.progress = 0;
          npc.def.quest.done = false;
        }
      }
      return { success: true, message: 'Квест принят!' };
    }

    case 'give_xp': {
      p.xp += action.amount;
      return { success: true, message: '+' + action.amount + ' XP' };
    }

    case 'trade': {
      if (p.seeds < action.cost) {
        return { success: false, message: 'Недостаточно семечек!' };
      }
      p.seeds -= action.cost;
      switch (action.reward) {
        case 'hp':
          p.maxHp += action.amount;
          p.hp = Math.min(p.hp + action.amount, p.maxHp);
          break;
        case 'stamina':
          p.maxStamina += action.amount;
          p.stamina = Math.min(p.stamina + action.amount, p.maxStamina);
          break;
        case 'damage':
          p.upgrades.damage += action.amount;
          break;
        case 'speed':
          p.speed += action.amount;
          break;
        case 'full_heal':
          p.hp = p.maxHp;
          p.stamina = p.maxStamina;
          break;
        case 'xp':
          p.xp += action.amount;
          break;
      }
      return { success: true, message: 'Покупка совершена! -' + action.cost + ' семечек' };
    }

    case 'reputation': {
      if (p.reputation === undefined) p.reputation = 0;
      p.reputation = Math.max(-100, Math.min(100, p.reputation + action.change));
      const dir = action.change > 0 ? '+' : '';
      return { success: true, message: 'Репутация ' + dir + action.change };
    }

    case 'steal': {
      const roll = Math.random();
      if (roll < action.successChance) {
        if (action.reward === 'seeds') {
          p.seeds += action.amount;
        }
        if (p.reputation === undefined) p.reputation = 0;
        p.reputation = Math.max(-100, p.reputation - 10);
        return { success: true, message: 'Успех! +' + action.amount + ' ' + action.reward };
      } else {
        if (action.failConsequence === 'hostile' && npc) {
          npc.hostile = true;
        }
        if (p.reputation === undefined) p.reputation = 0;
        p.reputation = Math.max(-100, p.reputation - 15);
        return { success: false, message: 'Провал! Тебя поймали!' };
      }
    }

    case 'bluff': {
      const bluffRoll = Math.random();
      if (bluffRoll < action.successChance) {
        if (action.reward === 'seeds') {
          p.seeds += action.amount;
        }
        return { success: true, message: 'Блеф удался! +' + action.amount + ' ' + action.reward };
      } else {
        if (action.failConsequence === 'reputation_loss') {
          if (p.reputation === undefined) p.reputation = 0;
          p.reputation = Math.max(-100, p.reputation - 20);
        }
        if (action.failConsequence === 'hostile' && npc) {
          npc.hostile = true;
        }
        return { success: false, message: 'Блеф провалился! Репутация потеряна.' };
      }
    }

    case 'hire_companion': {
      if (p.seeds < action.cost) {
        return { success: false, message: 'Недостаточно семечек!' };
      }
      p.seeds -= action.cost;
      if (npc) {
        npc.isCompanion = true;
      }
      return { success: true, message: 'Компаньон нанят!' };
    }

    case 'give_item': {
      if (!p.inventory) p.inventory = [];
      p.inventory.push(action.item);
      return { success: true, message: 'Получен предмет: ' + (action.item.name || 'предмет') };
    }

    default:
      return { success: true, message: '' };
  }
}

export { DIALOGUE_TREES };
