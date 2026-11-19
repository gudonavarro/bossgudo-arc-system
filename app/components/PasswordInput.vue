<script setup lang="ts">
defineOptions({ inheritAttrs: false });

const model = defineModel<string>({ required: true });
const props = withDefaults(
  defineProps<{
    id: string;
    disabled?: boolean;
    invalid?: boolean;
    toggleDisabled?: boolean;
    toggleLabel?: string;
  }>(),
  { toggleLabel: "password" },
);
const visible = ref(false);
</script>

<template>
  <div
    class="input w-full pr-1"
    :class="{ 'input-error': props.invalid }"
  >
    <AppIcon name="lock" size="size-4 text-base-content/40" />
    <input
      :id="id"
      v-model="model"
      v-bind="$attrs"
      :type="visible ? 'text' : 'password'"
      :disabled="disabled"
      :aria-invalid="invalid || undefined"
      class="grow"
    >
    <button
      class="btn btn-ghost btn-sm btn-square"
      type="button"
      :disabled="toggleDisabled ?? disabled"
      :aria-label="visible ? `Hide ${toggleLabel}` : `Show ${toggleLabel}`"
      :aria-pressed="visible"
      @click="visible = !visible"
    >
      <AppIcon :name="visible ? 'eye-off' : 'eye'" size="size-4" />
    </button>
  </div>
</template>
