'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { ArrowLeft, Upload, X } from 'lucide-react'
import Link from 'next/link'

export default function EditPlayerPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [player, setPlayer] = useState<any>(null)
  const [guardian, setGuardian] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  useEffect(() => { fetchPlayer() }, [params.id])

  async function fetchPlayer() {
    const { data } = await supabase
      .from('players')
      .select('*, guardian:guardians(*)')
      .eq('id', params.id as string)
      .single()
    if (!data) { router.push('/coach/players'); return }
    setPlayer(data)
    // guardian comes as array from one-to-many join
    const g = Array.isArray(data.guardian) ? data.guardian[0] : data.guardian
    setGuardian(g ?? {})
    setPhotoPreview(data.photo_url ?? null)
  }

  function setP(k: string, v: string) { setPlayer((p: any) => ({ ...p, [k]: v })) }
  function setG(k: string, v: string) { setGuardian((g: any) => ({ ...g, [k]: v })) }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Photo must be under 5MB'); return }

    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `players/${params.id}/photo.${ext}`

    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) { toast.error('Upload failed'); setUploading(false); return }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    setPhotoPreview(publicUrl)
    setPlayer((p: any) => ({ ...p, photo_url: publicUrl }))
    setUploading(false)
    toast.success('Photo uploaded!')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const { error: pe } = await supabase.from('players').update({
      full_name: player.full_name,
      date_of_birth: player.date_of_birth,
      category: player.category,
      position: player.position,
      nationality: player.nationality,
      school: player.school,
      address: player.address,
      medical_notes: player.medical_notes,
      photo_url: player.photo_url,
    }).eq('id', params.id as string)

    if (pe) { toast.error('Failed to save player: ' + pe.message); setSaving(false); return }

    if (guardian) {
      // guardian may come as array from supabase join
      const guardianId = Array.isArray(guardian) ? guardian[0]?.id : guardian.id
      const guardianData = Array.isArray(guardian) ? guardian[0] : guardian

      if (guardianId) {
        // Auto-link profile if email matches an existing account
        let profileId = guardianData.profile_id
        if (guardianData.email && !profileId) {
          const { data: matchedProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', guardianData.email.toLowerCase().trim())
            .single()
          if (matchedProfile) profileId = matchedProfile.id
        }

        const { error: ge } = await supabase.from('guardians').update({
          full_name: guardianData.full_name,
          relationship: guardianData.relationship,
          phone_primary: guardianData.phone_primary,
          phone_secondary: guardianData.phone_secondary,
          email: guardianData.email,
          ...(profileId ? { profile_id: profileId } : {}),
        }).eq('id', guardianId)
        if (ge) { toast.error('Guardian save failed: ' + ge.message); setSaving(false); return }

        // Also update the profile role if we just linked
        if (profileId && !guardianData.profile_id) {
          await supabase.from('profiles').update({ role: 'parent' }).eq('id', profileId)
          toast.success('Player updated and parent account linked!')
        } else {
          toast.success('Player updated!')
        }
      } else {
        toast.success('Player updated!')
      }
    }

    setSaving(false)
    router.push(`/coach/players/${params.id}`)
  }

  async function toggleActive() {
    const newStatus = !player.is_active
    await supabase.from('players').update({ is_active: newStatus }).eq('id', params.id as string)
    toast.success(newStatus ? 'Player reactivated' : 'Player deactivated')
    router.push('/coach/players')
  }

  if (!player) return (
    <div className="flex items-center justify-center min-h-screen text-white/30">
      <div className="animate-spin w-8 h-8 border-2 border-teal-400/30 border-t-teal-400 rounded-full"/>
    </div>
  )

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <Link href={`/coach/players/${params.id}`}
        className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-6 transition-colors">
        <ArrowLeft size={16}/> Back to Player
      </Link>
      <h1 className="page-title mb-6">Edit Player</h1>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Photo upload */}
        <div className="card p-5">
          <h2 className="section-title mb-4">Player Photo</h2>
          <div className="flex items-center gap-5">
            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
              {photoPreview ? (
                <img src={photoPreview} alt="Player photo" className="w-full h-full object-cover"/>
              ) : (
                <span className="text-white/20 text-3xl font-black font-condensed">
                  {player.full_name?.[0]?.toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => fileRef.current?.click()}
                className="btn-secondary flex items-center gap-2 text-sm"
                disabled={uploading}>
                <Upload size={14}/>{uploading ? 'Uploading…' : 'Upload Photo'}
              </button>
              {photoPreview && (
                <button type="button" onClick={() => { setPhotoPreview(null); setP('photo_url', '') }}
                  className="flex items-center gap-1.5 text-red-400/70 hover:text-red-400 text-sm transition-colors">
                  <X size={14}/> Remove
                </button>
              )}
              <p className="text-white/25 text-xs">JPG or PNG, max 5MB</p>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload}/>
        </div>

        {/* Player info */}
        <div className="card p-5 space-y-4">
          <h2 className="section-title">Player Information</h2>
          <div>
            <label className="label mb-1.5 block">Full Name *</label>
            <input className="input" required value={player.full_name || ''} onChange={e => setP('full_name', e.target.value)}/>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label mb-1.5 block">Date of Birth</label>
              <input type="date" className="input" value={player.date_of_birth || ''} onChange={e => setP('date_of_birth', e.target.value)}/>
            </div>
            <div>
              <label className="label mb-1.5 block">Nationality</label>
              <input className="input" value={player.nationality || ''} onChange={e => setP('nationality', e.target.value)}/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label mb-1.5 block">Category</label>
              <select className="input" value={player.category || 'U9'} onChange={e => setP('category', e.target.value)}>
                <option value="U9">U9</option>
                <option value="U13">U13</option>
                <option value="First Team">First Team</option>
              </select>
            </div>
            <div>
              <label className="label mb-1.5 block">Position</label>
              <select className="input" value={player.position || 'FWD'} onChange={e => setP('position', e.target.value)}>
                <option value="GK">GK</option>
                <option value="DEF">DEF</option>
                <option value="MID">MID</option>
                <option value="FWD">FWD</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label mb-1.5 block">School / Grade</label>
            <input className="input" value={player.school || ''} onChange={e => setP('school', e.target.value)}/>
          </div>
          <div>
            <label className="label mb-1.5 block">Address</label>
            <input className="input" value={player.address || ''} onChange={e => setP('address', e.target.value)}/>
          </div>
          <div>
            <label className="label mb-1.5 block">Medical Notes</label>
            <textarea className="input resize-none" rows={2} value={player.medical_notes || ''} onChange={e => setP('medical_notes', e.target.value)}/>
          </div>
        </div>

        {/* Guardian info */}
        {guardian && (
          <div className="card p-5 space-y-4">
            <h2 className="section-title">Guardian Information</h2>
            {guardian?.profile_id ? (
              <div className="flex items-center gap-2 p-2.5 bg-green-500/10 border border-green-500/20 rounded-xl mb-3">
                <span className="text-green-400 text-xs">✓</span>
                <span className="text-green-400 text-xs font-medium">Parent portal account linked</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-3">
                <span className="text-amber-400 text-xs">!</span>
                <span className="text-amber-400 text-xs">No parent portal account linked. Enter their email below and save — if they have an account it will link automatically.</span>
              </div>
            )}
            <div>
              <label className="label mb-1.5 block">Full Name</label>
              <input className="input" value={guardian.full_name || ''} onChange={e => setG('full_name', e.target.value)}/>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label mb-1.5 block">Relationship</label>
                <select className="input" value={guardian.relationship || 'Father'} onChange={e => setG('relationship', e.target.value)}>
                  {['Father','Mother','Uncle','Aunt','Sibling','Other'].map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="label mb-1.5 block">Primary Phone</label>
                <input className="input" value={guardian.phone_primary || ''} onChange={e => setG('phone_primary', e.target.value)}/>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label mb-1.5 block">Secondary Phone</label>
                <input className="input" value={guardian.phone_secondary || ''} onChange={e => setG('phone_secondary', e.target.value)}/>
              </div>
              <div>
                <label className="label mb-1.5 block">Email</label>
                <input type="email" className="input" value={guardian.email || ''} onChange={e => setG('email', e.target.value)}/>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button type="submit" className="btn-primary flex-1" disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <Link href={`/coach/players/${params.id}`} className="btn-secondary">Cancel</Link>
        </div>

        {/* Danger zone */}
        <div className="card p-5 border-red-500/20">
          <h2 className="text-red-400 text-xs font-bold uppercase tracking-wider mb-3">Danger Zone</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-medium">{player.is_active ? 'Deactivate Player' : 'Reactivate Player'}</p>
              <p className="text-white/30 text-xs mt-0.5">
                {player.is_active ? 'Hide from active roster' : 'Restore to active roster'}
              </p>
            </div>
            <button type="button" onClick={toggleActive}
              className={`text-sm font-medium px-4 py-2 rounded-xl border transition-all
                ${player.is_active
                  ? 'text-red-400 border-red-500/30 bg-red-500/10 hover:bg-red-500/20'
                  : 'text-green-400 border-green-500/30 bg-green-500/10 hover:bg-green-500/20'}`}>
              {player.is_active ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
