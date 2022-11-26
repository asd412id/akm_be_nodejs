import { col, fn, Op } from "sequelize";
import JadwalKategori from "../models/JadwalKategoriModel.js";
import Jadwal from "../models/JadwalModel.js";
import { getPagination, getPagingData } from "../utils/Pagination.js";

export const getJadwalKategoris = async (req, res) => {
  const { page, size, search } = req.query;
  const { limit, offset } = getPagination(page, size);

  try {
    const datas = await JadwalKategori.findAndCountAll({
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
        sekolahId: req.user.sekolahId
      },
      attributes: {
        include: [
          [fn('count', col('jadwals.id')), 'jadwal_count']
        ]
      },
      include: [
        {
          model: Jadwal,
          attributes: []
        }
      ],
      order: [
        ['createdAt', 'desc']
      ],
      group: ['id'],
      limit: limit,
      offset: offset,
      distinct: true
    });
    return res.status(200).json(getPagingData(datas, page, size));
  } catch (error) {
    return sendStatus(res, 500, 'Tidak dapat mengambil data: ' + error.message);
  }
}

export const getJadwalKategori = async (req, res) => {
  try {
    const data = await JadwalKategori.findOne({
      where: {
        id: req.params.id,
        sekolahId: req.user.sekolahId
      }
    });
    return res.status(200).json(data);
  } catch (error) {
    return sendStatus(res, 500, 'Tidak dapat mengambil data');
  }
}

export const store = async (req, res) => {
  const { name, desc } = req.body;
  if (!name) {
    return sendStatus(res, 406, 'Data yang dikirim tidak lengkap');
  }

  try {
    if (req.params?.id) {
      await JadwalKategori.update({ name, desc }, {
        where: {
          id: req.params.id,
          sekolahId: req.user.sekolahId
        }
      });
    } else {
      await JadwalKategori.create({ name, desc, sekolahId: req.user.sekolahId });
    }
    return sendStatus(res, 201, 'Data berhasil disimpan');
  } catch (error) {
    return sendStatus(res, 500, 'Data gagal disimpan');
  }
}

export const destroy = async (req, res) => {
  try {
    await JadwalKategori.destroy({
      where: {
        id: req.params.id,
        sekolahId: req.user.sekolahId
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