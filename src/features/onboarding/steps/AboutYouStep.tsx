import dayjs from 'dayjs';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { PhotoUpload } from '../../../components/PhotoUpload';
import { BIOLOGICAL_SEXES } from '../onboardingOptions';
import type { BiologicalSex } from '../../../types/profile';

export function AboutYouStep({
  name,
  onNameChange,
  birthdate,
  onBirthdateChange,
  sex,
  onSexChange,
  avatarUrl,
  onAvatarUrlChange,
  onAvatarUploadingChange,
}: {
  name: string;
  onNameChange: (value: string) => void;
  birthdate: string;
  onBirthdateChange: (value: string) => void;
  sex: BiologicalSex | '';
  onSexChange: (value: BiologicalSex) => void;
  avatarUrl: string | null;
  onAvatarUrlChange: (value: string | null) => void;
  onAvatarUploadingChange: (uploading: boolean) => void;
}) {
  return (
    <Stack spacing={2.5} sx={{ pt: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <PhotoUpload
          photoUrl={avatarUrl}
          onChange={onAvatarUrlChange}
          onUploadingChange={onAvatarUploadingChange}
          alt={name || 'your'}
          size={88}
        />
      </Box>
      <TextField label="Name" value={name} onChange={(e) => onNameChange(e.target.value)} required fullWidth />
      <DatePicker
        label="Birthdate"
        value={birthdate ? dayjs(birthdate) : null}
        onChange={(newValue) => onBirthdateChange(newValue?.isValid() ? newValue.format('YYYY-MM-DD') : '')}
        disableFuture
        minDate={dayjs().subtract(120, 'year')}
        slotProps={{ textField: { required: true, fullWidth: true } }}
      />
      <FormControl>
        <FormLabel sx={{ fontSize: 13 }}>Biological sex</FormLabel>
        <Typography fontSize={12} color="text.secondary" sx={{ mb: 0.5 }}>
          Used only to calculate your calorie needs accurately.
        </Typography>
        <RadioGroup row value={sex} onChange={(e) => onSexChange(e.target.value as BiologicalSex)}>
          {BIOLOGICAL_SEXES.map((option) => (
            <FormControlLabel key={option.value} value={option.value} control={<Radio />} label={option.label} />
          ))}
        </RadioGroup>
      </FormControl>
    </Stack>
  );
}
