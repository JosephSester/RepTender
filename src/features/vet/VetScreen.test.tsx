import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import VetScreen from './VetScreen';
import { db, resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
import { savePhoto } from '../../db/photos';
import { createVetVisit, listVetVisits } from '../../db/vetVisits';
import { renderAt } from '../../test/render';

// jsdom can't decode images: the photo pipeline returns fixed blobs.
vi.mock('../../db/vetVisits', async (orig) => {
  const real = await orig<typeof import('../../db/vetVisits')>();
  return { ...real, createVetVisit: vi.fn(real.createVetVisit) };
});
vi.mock('../../lib/image', () => ({
  photoFromFile: vi.fn(async () => ({ blob: new Blob(['full']), thumbBlob: new Blob(['thumb']), width: 4, height: 3 })),
}));

const now = new Date(2026, 10, 8, 9, 0);
let petId: string;

beforeEach(async () => {
  // Stored blobs aren't real Blobs under fake-indexeddb, so stub the object-URL calls usePhotoUrl makes.
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:photo');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  await resetDb();
  petId = (await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 })).id;
  const photoId = await savePhoto({ blob: new Blob(['x']), thumbBlob: new Blob(['y']), width: 4, height: 3 });
  await createVetVisit({
    petId, date: '2026-04-20', reason: 'New-pet check', notes: 'No mites, good body condition.', clinic: 'Exotic Animal Clinic',
  });
  await createVetVisit({
    petId, date: '2026-06-14', reason: 'Wellness exam', clinic: 'Exotic Animal Clinic', vet: 'Dr. Patel',
    phone: '(555) 201-4470', cost: 85, notes: 'Healthy. Weight 28 g.', photoIds: [photoId],
    nextAppointment: new Date(2027, 5, 14, 10, 0).toISOString(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderVet() {
  return render(
    <MemoryRouter initialEntries={[`/pets/${petId}/vet`]}>
      <Routes>
        <Route path="/pets/:id/vet" element={<VetScreen now={now} />} />
      </Routes>
    </MemoryRouter>,
  );
}

const photoFile = () => new File(['jpeg'], 'visit.jpg', { type: 'image/jpeg' });

describe('VetScreen', () => {
  it('shows the next appointment, the clinic and the history', async () => {
    renderVet();
    const next = await screen.findByRole('group', { name: 'Next appointment' });
    expect(within(next).getByText('Mon, Jun 14, 2027 · 10:00 AM')).toBeInTheDocument();
    expect(within(next).getByText('Exotic Animal Clinic')).toBeInTheDocument();
    expect(screen.getByText('Dr. Patel')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '(555) 201-4470' })).toHaveAttribute('href', 'tel:5552014470');

    const items = screen.getAllByRole('article');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Jun 14, 2026 · Wellness exam');
    expect(items[0]).toHaveTextContent('Healthy. Weight 28 g.');
    expect(items[0]).toHaveTextContent('$85 · 1 photo');
    expect(items[1]).toHaveTextContent('Apr 20, 2026 · New-pet check');

    await userEvent.click(within(items[0]!).getByRole('button', { name: 'Open photo' }));
    expect(await within(screen.getByRole('dialog', { name: 'Photo' })).findByRole('img', { name: 'Visit photo' })).toBeInTheDocument();
  });

  it('adds a visit with a photo, starting from the last clinic details', async () => {
    renderVet();
    await userEvent.click(await screen.findByRole('button', { name: 'New vet visit' }));
    const sheet = screen.getByRole('dialog', { name: 'New vet visit' });
    await vi.waitFor(() => expect(within(sheet).getByLabelText('Clinic')).toHaveValue('Exotic Animal Clinic'));
    expect(within(sheet).getByLabelText('Vet')).toHaveValue('Dr. Patel');
    await userEvent.type(within(sheet).getByLabelText('Reason'), 'Mites check');
    await userEvent.type(within(sheet).getByLabelText('Cost ($)'), '40');
    fireEvent.change(within(sheet).getByLabelText('Add photos'), { target: { files: [photoFile()] } });
    expect(await within(sheet).findByRole('button', { name: 'Remove photo' })).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save visit' }));
    await vi.waitFor(async () => expect(await listVetVisits(petId)).toHaveLength(3));
    const saved = (await listVetVisits(petId)).at(-1)!;
    expect(saved).toMatchObject({ date: '2026-11-08', reason: 'Mites check', cost: 40, clinic: 'Exotic Animal Clinic', phone: '(555) 201-4470' });
    expect(saved.photoIds).toHaveLength(1);
    expect(await db.photos.count()).toBe(2);
  });

  it('cancelling a new visit deletes the photos added to it', async () => {
    renderVet();
    await userEvent.click(await screen.findByRole('button', { name: 'New vet visit' }));
    const sheet = screen.getByRole('dialog', { name: 'New vet visit' });
    fireEvent.change(within(sheet).getByLabelText('Add photos'), { target: { files: [photoFile()] } });
    await within(sheet).findByRole('button', { name: 'Remove photo' });
    expect(await db.photos.count()).toBe(2);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    await vi.waitFor(async () => expect(await db.photos.count()).toBe(1));
  });

  it('edits a visit: removes its photo and its next appointment', async () => {
    renderVet();
    const [first] = await screen.findAllByRole('article');
    await userEvent.click(within(first!).getByRole('button', { name: 'Edit' }));
    const sheet = screen.getByRole('dialog', { name: 'Edit vet visit' });
    expect(within(sheet).getByLabelText('Reason')).toHaveValue('Wellness exam');
    expect(within(sheet).getByLabelText('Next appointment')).toHaveValue('2027-06-14');
    expect(within(sheet).getByLabelText('Appointment time')).toHaveValue('10:00');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Remove photo' }));
    fireEvent.change(within(sheet).getByLabelText('Next appointment'), { target: { value: '' } });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save visit' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const edited = (await listVetVisits(petId)).at(-1)!;
    expect(edited.photoIds).toEqual([]);
    expect(edited.nextAppointment).toBeUndefined();
    expect(await db.photos.count()).toBe(0);
    await vi.waitFor(() => expect(screen.queryByRole('group', { name: 'Next appointment' })).toBeNull());
  });

  it('clears the next appointment with the Clear button', async () => {
    renderVet();
    const [first] = await screen.findAllByRole('article');
    await userEvent.click(within(first!).getByRole('button', { name: 'Edit' }));
    const sheet = screen.getByRole('dialog', { name: 'Edit vet visit' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Clear next appointment' }));
    expect(within(sheet).getByLabelText('Next appointment')).toHaveValue('');
    expect(within(sheet).queryByLabelText('Appointment time')).toBeNull();
    expect(within(sheet).queryByRole('button', { name: 'Clear next appointment' })).toBeNull();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save visit' }));
    await vi.waitFor(async () => expect((await listVetVisits(petId)).at(-1)!.nextAppointment).toBeUndefined());
  });

  it('shows a phone with no digits as plain text, not a link', async () => {
    await createVetVisit({ petId, date: '2026-09-01', phone: 'n/a', clinic: 'Newest Clinic' });
    renderVet();
    await screen.findByText('Newest Clinic');
    expect(screen.getByText('n/a')).toBeInTheDocument();
    expect(screen.getByText('n/a').closest('a')).toBeNull();
    expect(screen.queryByRole('link', { name: '(555) 201-4470' })).toBeNull();
  });

  it('ignores Escape while a save is in flight, keeping the new photos', async () => {
    const real = await vi.importActual<typeof import('../../db/vetVisits')>('../../db/vetVisits');
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    vi.mocked(createVetVisit).mockImplementationOnce(async (input) => {
      await gate;
      return real.createVetVisit(input);
    });
    renderVet();
    await userEvent.click(await screen.findByRole('button', { name: 'New vet visit' }));
    const sheet = screen.getByRole('dialog', { name: 'New vet visit' });
    fireEvent.change(within(sheet).getByLabelText('Add photos'), { target: { files: [photoFile()] } });
    await within(sheet).findByRole('button', { name: 'Remove photo' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save visit' }));
    expect(within(sheet).getByRole('button', { name: 'Save visit' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'New vet visit' })).toBeInTheDocument();
    release();
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const saved = (await listVetVisits(petId)).at(-1)!;
    expect(saved.photoIds).toHaveLength(1);
    expect(await db.photos.get(saved.photoIds[0]!)).toBeDefined();
  });

  it('deletes a visit and its photos after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderVet();
    const [first] = await screen.findAllByRole('article');
    await userEvent.click(within(first!).getByRole('button', { name: 'Delete' }));
    await vi.waitFor(async () => expect(await listVetVisits(petId)).toHaveLength(1));
    expect(await db.photos.count()).toBe(0);
  });

  it('a cleared visit date blocks saving without crashing', async () => {
    renderVet();
    await userEvent.click(await screen.findByRole('button', { name: 'New vet visit' }));
    const sheet = screen.getByRole('dialog', { name: 'New vet visit' });
    await userEvent.clear(within(sheet).getByLabelText('Visit date'));
    expect(within(sheet).getByRole('button', { name: 'Save visit' })).toBeDisabled();
  });

  it('is routed at /pets/:id/vet', async () => {
    renderAt(`/pets/${petId}/vet`);
    expect(await screen.findByRole('heading', { name: 'Vet visits' })).toBeInTheDocument();
  });
});
