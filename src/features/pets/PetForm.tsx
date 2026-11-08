import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { archivePet, createPet, deletePet, getPet, updatePet } from '../../db/pets';
import { deletePhoto, savePhoto } from '../../db/photos';
import { listFoodItems } from '../../db/foodItems';
import { ValidationError } from '../../db/ids';
import { photoFromFile } from '../../lib/image';
import { usePhotoUrl } from '../../ui/usePhotoUrl';
import { speciesEmoji } from '../../ui/PetAvatar';
import { EMPTY_FORM, toForm, toInput, type FormState } from './petFormModel';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function PetForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const foods = useLiveQuery(() => listFoodItems(), []);
  const [form, setForm] = useState<FormState | null>(id ? null : EMPTY_FORM);
  const [originalPhotoId, setOriginalPhotoId] = useState<string>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const photoUrl = usePhotoUrl(form?.photoId, 'full');

  useEffect(() => {
    if (!id) return;
    getPet(id).then((pet) => {
      if (!pet) return navigate('/', { replace: true });
      setForm(toForm(pet));
      setOriginalPhotoId(pet.photoId);
    });
  }, [id, navigate]);

  if (!form) return null;
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm({ ...form, [key]: value });
  const text = (key: keyof FormState) => ({
    value: form[key] as string,
    onChange: (e: { target: { value: string } }) => set(key, e.target.value as never),
  });

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    try {
      const photoId = await savePhoto(await photoFromFile(file));
      setForm((f) => (f ? { ...f, photoId } : f));
      setError(undefined);
    } catch {
      setError("Couldn't read that photo.");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const input = toInput(form);
      let petId = id;
      if (id) await updatePet(id, input);
      else petId = (await createPet(input)).id;
      if (originalPhotoId && originalPhotoId !== form.photoId) await deletePhoto(originalPhotoId);
      navigate(`/pets/${petId}`, { replace: true });
    } catch (err) {
      setError(err instanceof ValidationError ? err.message : 'Could not save. Please try again.');
      setSaving(false);
    }
  }

  async function onArchive() {
    if (!id) return;
    await archivePet(id);
    navigate('/', { replace: true });
  }

  async function onDelete() {
    if (!id || !window.confirm(`Delete ${form!.name} and all of its records? This can't be undone.`)) return;
    await deletePet(id);
    navigate('/', { replace: true });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="topbar">
        <button type="button" onClick={() => navigate(-1)}>Cancel</button>
        <b>{id ? `Edit ${form.name || 'pet'}` : 'Add reptile'}</b>
        <button type="submit" disabled={saving}>Save</button>
      </div>

      <label className="photo-pick" style={{ display: 'block', textAlign: 'center', margin: '12px 0' }}>
        <div className="pet-avatar" style={{ width: 96, height: 96, fontSize: 52, borderRadius: 28, margin: '0 auto' }}>
          {photoUrl ? <img src={photoUrl} alt="" /> : speciesEmoji(form.species)}
        </div>
        <span style={{ color: 'var(--moss)', fontWeight: 700 }}>{form.photoId ? 'Change photo' : 'Add photo'}</span>
        <input type="file" accept="image/*" aria-label="Choose photo" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
      </label>

      {error && <div role="alert" className="form-error">{error}</div>}

      <div className="label">Basics</div>
      <Field label="Name"><input {...text('name')} autoComplete="off" /></Field>
      <Field label="Species"><input {...text('species')} placeholder="Corn Snake" /></Field>
      <Field label="Morph / breed"><input {...text('morph')} placeholder="Amel" /></Field>
      <Field label="Sex">
        <select value={form.sex} onChange={(e) => set('sex', e.target.value as FormState['sex'])}>
          <option value="unknown">Unknown</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
        </select>
      </Field>
      <Field label="Date of birth"><input type="date" {...text('birthDate')} /></Field>
      <Field label="Birth date is approximate">
        <input type="checkbox" className="switch" checked={form.birthDateApprox} onChange={(e) => set('birthDateApprox', e.target.checked)} />
      </Field>
      <label className="field stack">
        <span>Description</span>
        <textarea rows={3} {...text('description')} />
      </label>

      <div className="label">Feeding</div>
      <Field label="Feed every (days)"><input type="number" inputMode="numeric" min={1} {...text('feedingIntervalDays')} /></Field>
      <Field label="Usual food">
        <select value={form.usualFoodItem} onChange={(e) => set('usualFoodItem', e.target.value)}>
          <option value="">None</option>
          {foods?.map((f) => <option key={f.id} value={f.name}>{f.name}</option>)}
        </select>
      </Field>
      <Field label="Usual quantity"><input type="number" inputMode="numeric" min={1} {...text('usualQuantity')} /></Field>
      <Field label="Usual feeding time"><input type="time" {...text('usualFeedTime')} /></Field>

      <div className="label">Parents</div>
      <Field label="Sire name"><input {...text('sireName')} /></Field>
      <Field label="Sire morph"><input {...text('sireMorph')} /></Field>
      <Field label="Dam name"><input {...text('damName')} /></Field>
      <Field label="Dam morph"><input {...text('damMorph')} /></Field>

      <div className="label">Where it came from</div>
      <Field label="Origin">
        <select value={form.origin} onChange={(e) => set('origin', e.target.value as FormState['origin'])}>
          <option value="unknown">Unknown</option>
          <option value="captive_bred">Captive bred</option>
          <option value="wild_caught">Wild caught</option>
        </select>
      </Field>
      <Field label="Bought from"><input {...text('acquiredFrom')} /></Field>
      <Field label="Date bought"><input type="date" {...text('acquiredDate')} /></Field>
      <Field label="Price paid ($)"><input type="number" inputMode="decimal" min={0} {...text('pricePaid')} /></Field>

      <button type="submit" className="btn-primary" disabled={saving} style={{ marginTop: 16 }}>Save pet</button>

      {id && (
        <div style={{ marginTop: 24, display: 'grid', gap: 8 }}>
          <button type="button" className="btn-ghost" onClick={onArchive}>Archive pet</button>
          <button type="button" className="btn-ghost btn-danger" onClick={onDelete}>Delete pet</button>
        </div>
      )}
    </form>
  );
}
