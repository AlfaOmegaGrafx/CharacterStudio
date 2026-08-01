/**
 * Bridges TaskContext + CharacterManager onto SceneManager for the in-headset XR menu.
 * Must render under TaskProvider and SceneProvider.
 */
import { useEffect } from 'react';
import { useScene } from '../context/SceneContext';
import { useTask } from '../context/TaskContext';

export default function XrMenuBridge() {
  const { sceneManager, characterManager } = useScene();
  const {
    createAndStartTask,
    getAllTasks,
    getTaskStats,
    getTasksByType,
    taskManager,
  } = useTask();

  useEffect(() => {
    if (!sceneManager) return;

    sceneManager.getCharacterManager = () => characterManager ?? null;

    sceneManager.getXrTaskApi = () => ({
      createAndStartTask,
      getAllTasks,
      getTaskStats,
      getTasksByType,
      getApiEndpoint: () =>
        taskManager?.apiEndpoint ||
        import.meta.env.VITE_API_ENDPOINT ||
        '',
    });

    return () => {
      if (sceneManager.getXrTaskApi) {
        sceneManager.getXrTaskApi = null;
      }
    };
  }, [
    sceneManager,
    characterManager,
    createAndStartTask,
    getAllTasks,
    getTaskStats,
    getTasksByType,
    taskManager,
  ]);

  return null;
}
