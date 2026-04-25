import { useAuth } from '../../context/AuthContext';

import EventForm from './EventForm';
import PropertyForm from './PropertyForm';
import ServiceForm from './ServiceForm';
import StayForm from './StayForm';

const ROLE_FORM_MAP = {
  property_owner: { Form: PropertyForm },
  stay_owner: { Form: StayForm, category: 'stay' },
  hotel_owner: { Form: StayForm, category: 'stay' },
  service_provider: { Form: ServiceForm, category: 'services' },
  event_owner: { Form: EventForm, category: 'event' },
  admin: { Form: PropertyForm, category: 'home' },
};

export default function ListingFormRouter({ onSuccess, onClose }) {
  const { user } = useAuth();
  const mapping = ROLE_FORM_MAP[user?.role];

  if (!mapping) {
    return (
      <p className="text-center text-muted-foreground py-8">
        Your account type cannot create listings.
      </p>
    );
  }

  const { Form, category } = mapping;
  return <Form category={category} onSuccess={onSuccess} onClose={onClose} />;
}
