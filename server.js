const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Проверка переменных окружения
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('[Supabase] Ошибка: отсутствует SUPABASE_URL или SUPABASE_KEY');
  process.exit(1);
}

// Подключение к Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Настройка CORS
const corsOptions = {
  origin: '*', // Разрешаем запросы от всех доменов
  methods: 'GET,POST,PUT,DELETE,OPTIONS',
  allowedHeaders: 'Content-Type,Authorization'
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Обработка предварительных OPTIONS-запросов

// Middleware для обработки JSON
app.use(express.json());

// Главная страница
app.get('/', (req, res) => {
  res.send(`
    <p>This is the backend server for GUGACOIN.</p>
  `);
});

// Регистрация пользователя
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'логин и пароль обязательны' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'пароль должен содержать минимум 6 символов' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    // Генерируем 6-значный userId
    const userId = Math.floor(100000 + Math.random() * 900000).toString();

    // Добавляем поле blocked со значением 0 (не заблокирован)
    const { error } = await supabase
      .from('users')
      .insert([{ username, password: hashedPassword, user_id: userId, balance: 0, blocked: 0 }]);

    if (error) {
      // Если ошибка связана с нарушением уникальности (логин уже существует)
      if (error.message.includes('unique_violation')) {
        return res.status(409).json({ success: false, error: 'такой логин уже существует' });
      }
      return res.status(500).json({ success: false, error: 'такой логин уже существует' });
    }

    console.log(`[Регистрация] Новый пользователь: ${username}`);
    res.json({ success: true, userId });
  } catch (error) {
    console.error('[Регистрация] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Авторизация пользователя
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !data) {
      return res.status(401).json({ success: false, error: 'неверные учетные данные' });
    }

    // Если аккаунт заблокирован, возвращаем ошибку
    if (data.blocked === 1) {
      return res.status(403).json({ success: false, error: 'аккаунт заблокирован' });
    }

    const isPasswordValid = await bcrypt.compare(password, data.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, error: 'неверные учетные данные' });
    }

    console.log(`[Login] Пользователь вошёл: ${username}`);
    res.json({ success: true, userId: data.user_id });
  } catch (error) {
    console.error('[Login] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'ошибка сервера' });
  }
});

// Обновление баланса (добыча монет)
// Здесь дополнительно обновляется глобальная статистика добычи в таблице halving,
// где обновляются поля total_mined и halving_step
app.post('/update', async (req, res) => {
  try {
    const { userId, amount = 0.00001 } = req.body;
    console.log('[Update] Получен запрос:', { userId, amount });
    if (!userId) {
      return res.status(400).json({ success: false, error: 'ID пользователя обязателен' });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, error: 'неверная сумма' });
    }

    // Получаем текущий баланс пользователя
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (fetchError || !userData) {
      return res.status(404).json({ success: false, error: 'пользователь не найден' });
    }

    // Вычисляем новый баланс с точностью до 5 знаков после запятой
    const newBalance = parseFloat((userData.balance || 0) + amount).toFixed(5);

    // Обновляем баланс пользователя
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('user_id', userId);

    if (updateError) {
      return res.status(500).json({ success: false, error: 'обновление баланса не удалось' });
    }

    // Теперь обновляем глобальные данные по добыче в таблице halving
    // Предполагается, что таблица halving имеет поля: total_mined (numeric) и halving_step (integer)
    // Сначала получаем существующую запись (если она есть)
    const { data: halvingData, error: halvingError } = await supabase
      .from('halving')
      .select('*')
      .limit(1);

    let newTotalMined = amount;
    if (!halvingError && halvingData && halvingData.length > 0) {
      // Если запись существует, прибавляем к текущему значению
      newTotalMined = parseFloat(halvingData[0].total_mined || 0) + amount;
    }
    // Вычисляем новый уровень халвинга (например, как целая часть от общего количества добытых монет)
    const newHalvingStep = Math.floor(newTotalMined);

    // Обновляем (или вставляем) запись в таблице halving:
    const { error: upsertError } = await supabase
      .from('halving')
      .upsert([{ total_mined: newTotalMined, halving_step: newHalvingStep }]);

    if (upsertError) {
      console.error('[Update] Ошибка обновления данных по халвингу:', upsertError.message);
      // Можно не прерывать выполнение, если ошибка в статистике
    }

    console.log('[Update] Баланс обновлён успешно:', newBalance, 'Общий добытый:', newTotalMined, 'Халвинг:', newHalvingStep);
    res.json({ success: true, balance: newBalance, halvingStep: newHalvingStep });
  } catch (error) {
    console.error('[Update] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'внутренняя ошибка сервера' });
  }
});

// Получение данных пользователя (включая уровень халвинга)
// Обратите внимание: здесь возвращается только информация о пользователе, а данные по халвингу
// из таблицы halving используются на серверной стороне для анализа общего количества добытых монет.
app.get('/user', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'ID пользователя обязателен' });
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'пользователь не найден' });
    }

    // Получаем данные по халвингу (если есть) для передачи на клиент
    let halvingStep = 0;
    const { data: halvingData, error: halvingError } = await supabase
      .from('halving')
      .select('halving_step')
      .limit(1);
    if (!halvingError && halvingData && halvingData.length > 0) {
      halvingStep = halvingData[0].halving_step;
    }

    console.log(`[User] Данные получены для пользователя: ${userId}`);
    res.json({ success: true, user: { ...data, halvingStep } });
  } catch (error) {
    console.error('[User] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'не удалось получить данные пользователя' });
  }
});

// Перевод монет
app.post('/transfer', async (req, res) => {
  try {
    const { fromUserId, toUserId, amount } = req.body;
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, error: 'неверная сумма' });
    }
    if (fromUserId === toUserId) {
      return res.status(400).json({ success: false, error: 'вы не можете перевести монеты самому себе' });
    }

    // Проверяем отправителя
    const { data: fromUser, error: fromError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', fromUserId)
      .single();
    if (fromError || !fromUser) {
      return res.status(404).json({ success: false, error: 'отправитель не найден' });
    }
    if ((fromUser.balance || 0) < amount) {
      return res.status(400).json({ success: false, error: 'недостаточно средств' });
    }

    // Проверяем получателя
    const { data: toUser, error: toError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', toUserId)
      .single();
    if (toError || !toUser) {
      return res.status(404).json({ success: false, error: 'получатель не найден' });
    }

    const newFromBalance = parseFloat((fromUser.balance || 0) - amount).toFixed(5);
    const newToBalance = parseFloat((toUser.balance || 0) + amount).toFixed(5);

    // Обновляем баланс отправителя
    const { error: updateFromError } = await supabase
      .from('users')
      .update({ balance: newFromBalance })
      .eq('user_id', fromUserId);
    if (updateFromError) {
      return res.status(500).json({ success: false, error: 'ошибка обновления баланса отправителя' });
    }

    // Обновляем баланс получателя
    const { error: updateToError } = await supabase
      .from('users')
      .update({ balance: newToBalance })
      .eq('user_id', toUserId);
    if (updateToError) {
      return res.status(500).json({ success: false, error: 'ошибка обновления баланса получателя' });
    }

    // Записываем транзакцию
    console.log('[Transfer] Запись транзакции:', { fromUserId, toUserId, amount });
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert([
        {
          from_user_id: fromUserId,
          to_user_id: toUserId,
          amount: amount
        }
      ]);
    if (transactionError) {
      return res.status(500).json({ success: false, error: 'не удалось записать транзакцию' });
    }

    console.log(`[Transfer] Перевод ${amount} монет от ${fromUserId} к ${toUserId} выполнен успешно`);
    res.json({ success: true, fromBalance: newFromBalance, toBalance: newToBalance });
  } catch (error) {
    console.error('[Transfer] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'перевод не удался' });
  }
});

// Получение истории транзакций
app.get('/transactions', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'ID пользователя обязателен' });
    }

    // Получаем транзакции, где пользователь является отправителем
    const { data: sentTransactions, error: sentError } = await supabase
      .from('transactions')
      .select('*')
      .eq('from_user_id', userId)
      .order('created_at', { ascending: false });

    // Получаем транзакции, где пользователь является получателем
    const { data: receivedTransactions, error: receivedError } = await supabase
      .from('transactions')
      .select('*')
      .eq('to_user_id', userId)
      .order('created_at', { ascending: false });

    if (sentError || receivedError) {
      return res.status(500).json({ success: false, error: 'не удалось получить транзакции' });
    }

    // Объединяем транзакции и сортируем по дате (сначала самые свежие)
    const transactions = [
      ...(sentTransactions || []).map(tx => ({ ...tx, type: 'sent' })),
      ...(receivedTransactions || []).map(tx => ({ ...tx, type: 'received' }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ success: true, transactions });
  } catch (error) {
    console.error('[Transactions] Ошибка:', error.stack);
    res.status(500).json({ success: false, error: 'не удалось получить транзакции' });
  }
});

// Запуск сервера
app.listen(port, '0.0.0.0', () => {
  console.log(`[Server] Запущен на http://localhost:${port}`);
});
