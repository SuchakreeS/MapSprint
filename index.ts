// App entry point.
// Background tasks must be registered at module load time, before the router
// mounts anything, because Android can start the JS bundle with no UI at all.
import './src/features/recording/location-task';
import 'expo-router/entry';
