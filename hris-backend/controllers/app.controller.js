const db = require('../config/db');

const DEFAULT_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.bahi360.app';

// Public endpoint used by the mobile app to enforce a minimum app version
// (force update). Values live in system_settings.global_config.appVersions.<platform>.
exports.getAppVersion = async (req, res) => {
  const platform = req.query.platform === 'ios' ? 'ios' : 'android';
  try {
    const [rows] = await db.execute(
      'SELECT global_config FROM system_settings WHERE id = 1'
    );
    const globalConfig =
      rows.length > 0 && rows[0].global_config
        ? typeof rows[0].global_config === 'string'
          ? JSON.parse(rows[0].global_config)
          : rows[0].global_config
        : {};
    const config = globalConfig.appVersions?.[platform] || {};

    res.json({
      platform,
      minVersionCode: Number(config.minVersionCode) || 0,
      playStoreUrl: config.playStoreUrl || DEFAULT_PLAY_STORE_URL,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch app version.' });
  }
};