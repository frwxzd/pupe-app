import { runRetention, SUSPENSION_GRACE_DAYS } from '../src/lib/retention'
import { sendSuspensionNotice } from './mail'
import type { Store } from './store'

/**
 * Aplica la conservación de datos: depura objetos, suspende y elimina cuentas.
 * Borra en la misma transacción las sesiones de las cuentas suspendidas y, de las
 * eliminadas, también su contraseña y sus códigos. Después avisa por correo.
 */
export async function runRetentionJob(store: Store, now = new Date(), log: (err: unknown) => void = console.error) {
  const result = await store.mutate((db) => runRetention(db, now), async (tx, r) => {
    const closed = [...r.suspended.map((u) => u.id), ...r.deleted]
    if (closed.length) await tx.query('DELETE FROM sessions WHERE user_id = ANY($1)', [closed])
    if (r.deleted.length) {
      await tx.query('DELETE FROM credentials WHERE user_id = ANY($1)', [r.deleted])
      await tx.query('DELETE FROM password_resets WHERE user_id = ANY($1)', [r.deleted])
    }
  })
  for (const u of result.suspended) sendSuspensionNotice(u.email, u.name, SUSPENSION_GRACE_DAYS).catch(log)
  return { objetosDepurados: result.purgedItems.length, cuentasSuspendidas: result.suspended.length, cuentasEliminadas: result.deleted.length }
}
