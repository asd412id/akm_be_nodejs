const { existsSync, rmSync } = require("fs");
const { col, fn, Op, Transaction } = require("sequelize");
const Mapel = require("../models/MapelModel.js");
const Jadwal = require("../models/JadwalModel.js");
const { getPagination, getPagingData } = require("../utils/Pagination.js");
const Peserta = require("../models/PesertaModel.js");
const Soal = require("../models/SoalModel.js");
const db = require("../configs/Database.js");
const User = require("../models/UserModel.js");

module.exports.getJadwals = async (req, res) => {
  const { page, size, search } = req.query;
  const { limit, offset } = getPagination(page, size);

  try {
    const datas = req.user.role === 'OPERATOR' ? await Jadwal.findAndCountAll({
      subQuery: false,
      where: {
        [Op.or]: [
          {
            name: {
              [Op.substring]: search
            }
          },
          {
            desc: {
              [Op.substring]: search
            }
          }
        ],
        jadwalKategoryId: req.params.jid
      },
      include: [
        {
          model: Peserta,
          attributes: [
            'id',
            ['ruang', 'text']
          ],
          group: ['ruang']
        },
        {
          model: Soal,
          attributes: [
            'id',
            [fn('concat', col('soals.name'), ' ', '(', col('soals.desc'), ')'), 'text']
          ],
          group: ['id']
        }
      ],
      order: [
        ['active', 'desc'],
        ['start', 'asc']
      ],
      distinct: true,
      limit: limit,
      offset: offset
    }) : await Jadwal.findAndCountAll({
      subQuery: false,
      where: {
        [Op.or]: [
          {
            name: {
              [Op.substring]: search
            }
          },
          {
            desc: {
              [Op.substring]: search
            }
          }
        ],
        jadwalKategoryId: req.params.jid,
        '$soals->mapel->users.id$': { [Op.eq]: req.user.id }
      },
      include: [
        {
          model: Peserta,
          attributes: [
            'id',
            ['ruang', 'text']
          ],
          group: ['ruang']
        },
        {
          model: Soal,
          attributes: [
            'id',
            [fn('concat', col('soals.name'), ' ', '(', col('soals.desc'), ')'), 'text']
          ],
          include: [
            {
              model: Mapel,
              attributes: [],
              include: [
                {
                  model: User,
                  attributes: []
                }
              ]
            }
          ],
          group: ['id']
        }
      ],
      order: [
        ['active', 'desc'],
        ['start', 'asc']
      ],
      distinct: true,
      limit: limit,
      offset: offset
    });
    return res.status(200).json(getPagingData(datas, page, size));
  } catch (error) {
    return sendStatus(res, 500, 'Tidak dapat mengambil data: ' + error.message);
  }
}

module.exports.getJadwal = async (req, res) => {
  try {
    const data = await Jadwal.findOne({
      where: {
        id: req.params.id,
        jadwalKategoryId: req.params.jid
      }
    });
    return res.status(200).json(data);
  } catch (error) {
    return sendStatus(res, 500, 'Tidak dapat mengambil data');
  }
}

module.exports.store = async (req, res) => {
  const { name, desc, start, end, duration, soal_count, shuffle, show_score, active, soals, ruangs } = req.body;
  if (!name || !start || !end || !duration || !soal_count || !soals.length || !ruangs.length) {
    return sendStatus(res, 406, 'Data yang dikirim tidak lengkap');
  }

  const s = [];
  const r = [];
  soals.forEach(v => {
    s.push(v.id);
  });

  ruangs.forEach(v => {
    r.push(v.text);
  });

  const tr = await db.transaction();
  try {
    const pesertas = await Peserta.findAll({
      where: {
        ruang: {
          [Op.in]: r
        }
      },
      attributes: ['id']
    });
    const dataSoals = await Soal.findAll({
      where: {
        id: {
          [Op.in]: s
        }
      },
      attributes: ['id']
    });

    if (req.params?.id) {
      await Jadwal.update({
        name,
        desc,
        start,
        end,
        duration,
        soal_count,
        shuffle,
        show_score,
        active
      },
        {
          where: {
            id: req.params.id,
            jadwalKategoryId: req.params.jid
          }
        }
      );
      const jadwal = await Jadwal.findByPk(req.params.id);
      jadwal.setSoals(dataSoals);
      jadwal.setPesertas(pesertas);
    } else {
      const jadwal = await Jadwal.create({
        name,
        desc,
        start,
        end,
        duration,
        soal_count,
        shuffle,
        show_score,
        active,
        jadwalKategoryId: req.params.jid,
      });
      jadwal.addPesertas(pesertas);
      jadwal.addSoals(dataSoals);
    }
    tr.commit();
    return sendStatus(res, 201, 'Data berhasil disimpan');
  } catch (error) {
    tr.rollback();
    return sendStatus(res, 500, 'Data gagal disimpan: ' + error.message);
  }
}

module.exports.destroy = async (req, res) => {
  try {
    if (existsSync(`${process.env.APP_ASSETS_PATH}/assets/${req.params.id}`)) {
      rmSync(`${process.env.APP_ASSETS_PATH}/assets/${req.params.id}`, { recursive: true, force: true });
    }
    await Jadwal.destroy({
      where: {
        id: req.params.id,
        jadwalKategoryId: req.params.jid
      }
    });
    return sendStatus(res, 202, 'Data berhasil dihapus');
  } catch (error) {
    return sendStatus(res, 500, 'Data gagal dihapus');
  }
}

const sendStatus = (res, status, text) => {
  return res.status(status).json({ message: text });
}